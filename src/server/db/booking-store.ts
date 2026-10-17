import "server-only";
import type {Pool,PoolClient} from "pg";
import type {BookingRecord,BookingStatus,TimeInterval} from "@/core/domain/types";
import type {BookingStore,ConvertHoldInput,ConvertResult,CreateHoldInput,HoldResult,MoveResult,TransitionPatch} from "@/core/booking/store";
import {EXCLUSION_VIOLATION,UNIQUE_VIOLATION,inTransaction,lockHost,pgCode} from "./postgres";

type Row={id:string;host_id:string;provider:string;status:string;starts_at:Date;ends_at:Date;hold_expires_at:Date|null;visitor_name:string|null;visitor_email:string|null;visitor_timezone:string|null;notes:string|null;title:string|null;idempotency_key:string|null;external_event_id:string|null;external_event_url:string|null;failure_reason:string|null;created_at:Date;updated_at:Date};
const COLUMNS="id,host_id,provider,status,starts_at,ends_at,hold_expires_at,visitor_name,visitor_email,visitor_timezone,notes,title,idempotency_key,external_event_id,external_event_url,failure_reason,created_at,updated_at";
const iso=(d:Date|null)=>d?d.toISOString():null;
function toRecord(r:Row):BookingRecord{return{id:r.id,hostId:r.host_id,provider:r.provider as BookingRecord["provider"],status:r.status as BookingStatus,start:r.starts_at.toISOString(),end:r.ends_at.toISOString(),holdExpiresAt:iso(r.hold_expires_at),visitorName:r.visitor_name,visitorEmail:r.visitor_email,visitorTimezone:r.visitor_timezone,notes:r.notes,title:r.title,idempotencyKey:r.idempotency_key,externalEventId:r.external_event_id,externalEventUrl:r.external_event_url,failureReason:r.failure_reason,createdAt:r.created_at.toISOString(),updatedAt:r.updated_at.toISOString()}}
const OCCUPYING="(status in ('pending_event','confirmed','needs_reconciliation') or (status='held' and hold_expires_at > $3))";

/** Postgres implementation. Atomicity comes from transactions + row locks; double-booking from `bookings_no_overlap`. */
export class PostgresBookingStore implements BookingStore{
 constructor(private readonly pool:Pool){}

 async occupiedIntervals(hostId:string,range:TimeInterval,now:Date,excludeIds:string[]=[]){
  const r=await this.pool.query<{starts_at:Date;ends_at:Date}>(`select starts_at,ends_at from bookings where host_id=$1 and slot && tstzrange($2::timestamptz,$4::timestamptz,'[)') and ${OCCUPYING} and not (id = any($5::uuid[]))`,[hostId,range.start,now,range.end,excludeIds]);
  return r.rows.map(x=>({start:x.starts_at.toISOString(),end:x.ends_at.toISOString()}));
 }

 async createHold(input:CreateHoldInput):Promise<HoldResult>{
  try{
   return await inTransaction(this.pool,async c=>{
    await lockHost(c,input.hostId);
    await c.query("update bookings set status='expired',updated_at=$2 where host_id=$1 and status='held' and hold_expires_at <= $2",[input.hostId,input.now]);
    const r=await c.query<Row>(`insert into bookings (id,host_id,calendar_account_id,provider,status,starts_at,ends_at,hold_expires_at,created_at,updated_at) values ($1,$2,$3,$4,'held',$5,$6,$7,$8,$8) returning ${COLUMNS}`,[input.id,input.hostId,input.calendarAccountId??null,input.provider,input.start,input.end,input.expiresAt,input.now]);
    return{ok:true as const,hold:toRecord(r.rows[0])};
   });
  }catch(err){if(pgCode(err)===EXCLUSION_VIOLATION)return{ok:false,reason:"slot_taken"};throw err}
 }

 async releaseHold(holdId:string,now:Date){await this.pool.query("update bookings set status='released',updated_at=$2 where id=$1 and status='held'",[holdId,now])}

 async get(id:string){const r=await this.pool.query<Row>(`select ${COLUMNS} from bookings where id=$1`,[id]);return r.rows[0]?toRecord(r.rows[0]):null}
 async findByIdempotencyKey(hostId:string,key:string){const r=await this.pool.query<Row>(`select ${COLUMNS} from bookings where host_id=$1 and idempotency_key=$2`,[hostId,key]);return r.rows[0]?toRecord(r.rows[0]):null}

 async convertHold(input:ConvertHoldInput):Promise<ConvertResult>{
  try{
   return await inTransaction(this.pool,async c=>{
    const owner=await c.query<{host_id:string}>("select host_id from bookings where id=$1",[input.holdId]);
    if(!owner.rows[0])return{ok:false as const,reason:"hold_not_found" as const};
    await lockHost(c,owner.rows[0].host_id);
    const h=await c.query<Row>(`select ${COLUMNS} from bookings where id=$1 for update`,[input.holdId]);
    const hold=h.rows[0];
    if(!hold||hold.status!=="held")return{ok:false as const,reason:"hold_not_found" as const};
    if(hold.hold_expires_at!.getTime()<=input.now.getTime()){await c.query("update bookings set status='expired',updated_at=$2 where id=$1",[hold.id,input.now]);return{ok:false as const,reason:"hold_expired" as const}}
    const r=await c.query<Row>(`update bookings set status='pending_event',hold_expires_at=null,visitor_name=$2,visitor_email=$3,visitor_timezone=$4,notes=$5,title=$6,idempotency_key=$7,updated_at=$8 where id=$1 returning ${COLUMNS}`,[hold.id,input.visitorName,input.visitorEmail,input.visitorTimezone,input.notes,input.title,input.idempotencyKey,input.now]);
    return{ok:true as const,booking:toRecord(r.rows[0])};
   });
  }catch(err){if(pgCode(err)===UNIQUE_VIOLATION)return{ok:false,reason:"idempotency_conflict"};throw err}
 }

 async transition(id:string,from:readonly BookingStatus[],patch:TransitionPatch){
  // In a transaction so a deadlock with a concurrent slot claim is retried rather than surfaced as an error.
  const r=await inTransaction(this.pool,c=>c.query<Row>(`update bookings set status=$3,updated_at=$4,
    external_event_id=case when $5::boolean then $6 else external_event_id end,
    external_event_url=case when $7::boolean then $8 else external_event_url end,
    failure_reason=case when $9::boolean then $10 else failure_reason end
   where id=$1 and status = any($2::text[]) returning ${COLUMNS}`,
   [id,[...from],patch.status,patch.now,patch.externalEventId!==undefined,patch.externalEventId??null,patch.externalEventUrl!==undefined,patch.externalEventUrl??null,patch.failureReason!==undefined,patch.failureReason?.slice(0,500)??null]));
  return r.rows[0]?toRecord(r.rows[0]):null;
 }

 async moveToHold(bookingId:string,holdId:string,now:Date):Promise<MoveResult>{
  try{
   return await inTransaction(this.pool,async(c:PoolClient)=>{
    // Lock in a stable order (booking, then hold) to avoid deadlocks between concurrent reschedules.
    const owner=await c.query<{host_id:string}>("select host_id from bookings where id=$1",[bookingId]);
    if(!owner.rows[0])return{ok:false as const,reason:"booking_not_found" as const};
    await lockHost(c,owner.rows[0].host_id);
    const b=await c.query<Row>(`select ${COLUMNS} from bookings where id=$1 for update`,[bookingId]);
    if(!b.rows[0])return{ok:false as const,reason:"booking_not_found" as const};
    const h=await c.query<Row>(`select ${COLUMNS} from bookings where id=$1 for update`,[holdId]);
    const hold=h.rows[0];
    if(!hold||hold.status!=="held"||hold.host_id!==b.rows[0].host_id)return{ok:false as const,reason:"hold_not_found" as const};
    if(hold.hold_expires_at!.getTime()<=now.getTime())return{ok:false as const,reason:"hold_expired" as const};
    await c.query("update bookings set status='consumed',updated_at=$2 where id=$1",[holdId,now]);
    const r=await c.query<Row>(`update bookings set starts_at=$2,ends_at=$3,status='confirmed',failure_reason=null,updated_at=$4 where id=$1 returning ${COLUMNS}`,[bookingId,hold.starts_at,hold.ends_at,now]);
    return{ok:true as const,booking:toRecord(r.rows[0])};
   });
  }catch(err){if(pgCode(err)===EXCLUSION_VIOLATION)return{ok:false,reason:"slot_taken"};throw err}
 }

 async listForHost(hostId:string,from:Date,limit:number){
  const r=await this.pool.query<Row>(`select ${COLUMNS} from bookings where host_id=$1 and ends_at >= $2 and status in ('pending_event','confirmed','needs_reconciliation','failed','cancelled') order by starts_at limit $3`,[hostId,from,limit]);
  return r.rows.map(toRecord);
 }
}
