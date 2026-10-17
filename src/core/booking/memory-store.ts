import {SLOT_OCCUPYING_STATUSES,type BookingRecord,type BookingStatus,type TimeInterval} from "../domain/types";
import type {BookingStore,ConvertHoldInput,ConvertResult,CreateHoldInput,HoldResult,MoveResult,TransitionPatch} from "./store";

const overlaps=(a:TimeInterval,b:TimeInterval)=>Date.parse(a.start)<Date.parse(b.end)&&Date.parse(a.end)>Date.parse(b.start);

/** Reference implementation with the same semantics as the Postgres store. Used by tests; not for production. */
export class InMemoryBookingStore implements BookingStore{
 readonly rows=new Map<string,BookingRecord>();
 private occupying(r:BookingRecord){return SLOT_OCCUPYING_STATUSES.includes(r.status)}
 private conflicts(hostId:string,slot:TimeInterval,ignore:string[]){return[...this.rows.values()].some(r=>r.hostId===hostId&&!ignore.includes(r.id)&&this.occupying(r)&&overlaps(r,slot))}
 private save(r:BookingRecord){this.rows.set(r.id,structuredClone(r));return structuredClone(r)}

 async occupiedIntervals(hostId:string,range:TimeInterval,now:Date,excludeIds:string[]=[]){
  return[...this.rows.values()].filter(r=>r.hostId===hostId&&!excludeIds.includes(r.id)&&this.occupying(r)&&!(r.status==="held"&&Date.parse(r.holdExpiresAt!)<=now.getTime())&&overlaps(r,range)).map(r=>({start:r.start,end:r.end}));
 }
 async createHold(input:CreateHoldInput):Promise<HoldResult>{
  for(const r of this.rows.values())if(r.hostId===input.hostId&&r.status==="held"&&Date.parse(r.holdExpiresAt!)<=input.now.getTime())this.rows.set(r.id,{...r,status:"expired",updatedAt:input.now.toISOString()});
  if(this.conflicts(input.hostId,input,[]))return{ok:false,reason:"slot_taken"};
  const ts=input.now.toISOString();
  return{ok:true,hold:this.save({id:input.id,hostId:input.hostId,provider:input.provider,status:"held",start:input.start,end:input.end,holdExpiresAt:input.expiresAt.toISOString(),visitorName:null,visitorEmail:null,visitorTimezone:null,notes:null,title:null,idempotencyKey:null,externalEventId:null,externalEventUrl:null,failureReason:null,createdAt:ts,updatedAt:ts})};
 }
 async releaseHold(holdId:string,now:Date){const r=this.rows.get(holdId);if(r?.status==="held")this.rows.set(holdId,{...r,status:"released",updatedAt:now.toISOString()})}
 async get(id:string){const r=this.rows.get(id);return r?structuredClone(r):null}
 async findByIdempotencyKey(hostId:string,key:string){const r=[...this.rows.values()].find(r=>r.hostId===hostId&&r.idempotencyKey===key);return r?structuredClone(r):null}
 async convertHold(input:ConvertHoldInput):Promise<ConvertResult>{
  const r=this.rows.get(input.holdId);
  if(!r||r.status!=="held")return{ok:false,reason:"hold_not_found"};
  if(Date.parse(r.holdExpiresAt!)<=input.now.getTime()){this.rows.set(r.id,{...r,status:"expired",updatedAt:input.now.toISOString()});return{ok:false,reason:"hold_expired"}}
  if([...this.rows.values()].some(o=>o.hostId===r.hostId&&o.idempotencyKey===input.idempotencyKey))return{ok:false,reason:"idempotency_conflict"};
  return{ok:true,booking:this.save({...r,status:"pending_event",holdExpiresAt:null,visitorName:input.visitorName,visitorEmail:input.visitorEmail,visitorTimezone:input.visitorTimezone,notes:input.notes,title:input.title,idempotencyKey:input.idempotencyKey,updatedAt:input.now.toISOString()})};
 }
 async transition(id:string,from:readonly BookingStatus[],patch:TransitionPatch){
  const r=this.rows.get(id);if(!r||!from.includes(r.status))return null;
  return this.save({...r,status:patch.status,externalEventId:patch.externalEventId===undefined?r.externalEventId:patch.externalEventId,externalEventUrl:patch.externalEventUrl===undefined?r.externalEventUrl:patch.externalEventUrl,failureReason:patch.failureReason===undefined?r.failureReason:patch.failureReason,updatedAt:patch.now.toISOString()});
 }
 async moveToHold(bookingId:string,holdId:string,now:Date):Promise<MoveResult>{
  const hold=this.rows.get(holdId),booking=this.rows.get(bookingId);
  if(!booking)return{ok:false,reason:"booking_not_found"};
  if(!hold||hold.status!=="held"||hold.hostId!==booking.hostId)return{ok:false,reason:"hold_not_found"};
  if(Date.parse(hold.holdExpiresAt!)<=now.getTime())return{ok:false,reason:"hold_expired"};
  if(this.conflicts(booking.hostId,hold,[holdId,bookingId]))return{ok:false,reason:"slot_taken"};
  const ts=now.toISOString();this.rows.set(holdId,{...hold,status:"consumed",updatedAt:ts});
  return{ok:true,booking:this.save({...booking,start:hold.start,end:hold.end,status:"confirmed",failureReason:null,updatedAt:ts})};
 }
 async listForHost(hostId:string,from:Date,limit:number){return[...this.rows.values()].filter(r=>r.hostId===hostId&&Date.parse(r.end)>=from.getTime()&&!["held","expired","released","consumed"].includes(r.status)).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).slice(0,limit)}
}
