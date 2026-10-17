import {bufferedInterval,generateSlots,isOfferedSlot,overlapsAny,subtractInterval} from "../availability/policy";
import type {BookingRecord,CalendarAccount,CalendarProvider,Host,HostContext,TimeInterval} from "../domain/types";
import {CalendarProviderError,type CalendarAdapter} from "../integrations/calendar/adapter";
import type {BookingStore,HostDirectory} from "./store";

export type FailureCode="host_not_found"|"calendar_not_connected"|"calendar_unavailable"|"invalid_range"|"invalid_slot"|"slot_unavailable"|"hold_not_found"|"hold_expired"|"in_progress"|"provider_failed"|"booking_not_found"|"not_allowed";
export type Failure={ok:false;code:FailureCode;message:string;retryable:boolean};
export type BookingView={id:string;status:BookingRecord["status"];start:string;end:string;hostName:string;hostSlug:string;durationMinutes:number;visitorName:string|null;visitorEmail:string|null;visitorTimezone:string|null;failureReason:string|null};
/** `needs_reconciliation`: the calendar outcome is unknown. Never presented as booked. */
export type BookingOutcome={ok:true;outcome:"confirmed"|"needs_reconciliation";duplicate:boolean;booking:BookingView;manageUrl:string};

export type BookingServiceDeps={
 store:BookingStore;hosts:HostDirectory;calendars:(provider:CalendarProvider)=>CalendarAdapter;
 now:()=>Date;newId:()=>string;manageUrl:(bookingId:string)=>string;holdTtlSeconds:number;
 /** A pending_event row older than this is assumed abandoned (crash between steps 7 and 9) and is resumed. */
 staleAfterMs?:number;
 log?:(event:string,fields:Record<string,unknown>)=>void;
};

const MAX_RANGE_MS=31*86_400_000;
const fail=(code:FailureCode,message:string,retryable=false):Failure=>({ok:false,code,message,retryable});
const MESSAGES={
 slot:"That time is no longer available. Please choose another.",
 expired:"Your reserved time expired. Please choose a time again.",
 calendar:"Availability can't be checked right now. Please try again shortly.",
 provider:"The calendar did not accept the booking. Nothing was booked; please try again.",
 pending:"Your time is reserved, but the calendar has not confirmed yet. Please retry; you will not be double-booked.",
};

export class BookingService{
 constructor(private readonly d:BookingServiceDeps){}
 private log(event:string,fields:Record<string,unknown>){this.d.log?.(event,fields)}
 private view(b:BookingRecord,host:Host):BookingView{return{id:b.id,status:b.status,start:b.start,end:b.end,hostName:host.displayName,hostSlug:host.slug,durationMinutes:Math.round((Date.parse(b.end)-Date.parse(b.start))/60_000),visitorName:b.visitorName,visitorEmail:b.visitorEmail,visitorTimezone:b.visitorTimezone,failureReason:b.failureReason}}
 private slotFor(host:Host,start:string):TimeInterval{const s=Date.parse(start);return{start:new Date(s).toISOString(),end:new Date(s+host.policy.durationMinutes*60_000).toISOString()}}
 private async connected(ctx:HostContext|null):Promise<Failure|{ok:true;host:Host;calendar:CalendarAccount;adapter:CalendarAdapter}>{
  if(!ctx)return fail("host_not_found","This booking page does not exist.");
  if(!ctx.calendar)return fail("calendar_not_connected","This person isn't accepting bookings right now.");
  return{ok:true,host:ctx.host,calendar:ctx.calendar,adapter:this.d.calendars(ctx.calendar.provider)};
 }

 /** Steps 1–3: live busy time + DB occupancy → policy slots. Never returns busy-event details. */
 async listSlots(slug:string,range:TimeInterval){
  const c=await this.connected(await this.d.hosts.getBySlug(slug));if(!c.ok)return c;
  const s=Date.parse(range.start),e=Date.parse(range.end);
  if(!Number.isFinite(s)||!Number.isFinite(e)||e<=s||e-s>MAX_RANGE_MS)return fail("invalid_range","Invalid date range.");
  const now=this.d.now();const lookup=bufferedInterval(range,c.host.policy);
  let busy:TimeInterval[];
  try{busy=await c.adapter.getBusy(c.calendar,lookup)}catch(err){this.log("availability.provider_error",{hostId:c.host.id,error:describe(err)});return fail("calendar_unavailable",MESSAGES.calendar,true)}
  busy=busy.concat(await this.d.store.occupiedIntervals(c.host.id,lookup,now));
  return{ok:true as const,slots:generateSlots({policy:c.host.policy,now,range,busy}),durationMinutes:c.host.policy.durationMinutes,hostTimezone:c.host.policy.timezone};
 }

 /** Step 5: short-lived DB hold. Validated against policy and DB occupancy; live calendar is re-checked at confirm. */
 async createHold(slug:string,start:string){
  const c=await this.connected(await this.d.hosts.getBySlug(slug));if(!c.ok)return c;
  const slot=this.slotFor(c.host,start);const now=this.d.now();
  if(!isOfferedSlot({policy:c.host.policy,now,slot,busy:[]}))return fail("invalid_slot","That time can't be booked.");
  // Raw overlap is enforced by the store (DB exclusion). Buffers are enforced at confirm/reschedule re-check,
  // where the booking being rescheduled can be excluded from its own buffer.
  const expiresAt=new Date(now.getTime()+this.d.holdTtlSeconds*1000);
  const r=await this.d.store.createHold({id:this.d.newId(),hostId:c.host.id,provider:c.calendar.provider,calendarAccountId:c.calendar.id,start:slot.start,end:slot.end,expiresAt,now});
  if(!r.ok)return fail("slot_unavailable",MESSAGES.slot);
  return{ok:true as const,holdId:r.hold.id,start:r.hold.start,end:r.hold.end,expiresAt:r.hold.holdExpiresAt!};
 }

 async releaseHold(holdId:string){await this.d.store.releaseHold(holdId,this.d.now())}

 /** Steps 6–10. Safe to call repeatedly with the same idempotency key. */
 async confirm(input:{holdId:string;idempotencyKey:string;visitorName:string;visitorEmail:string;visitorTimezone:string;notes?:string}):Promise<BookingOutcome|Failure>{
  const hold=await this.d.store.get(input.holdId);
  if(!hold)return fail("hold_not_found",MESSAGES.expired);
  const c=await this.connected(await this.d.hosts.getById(hold.hostId));if(!c.ok)return c;
  const existing=await this.d.store.findByIdempotencyKey(hold.hostId,input.idempotencyKey);
  if(existing)return this.resume(existing,c.host,c.calendar,c.adapter);
  const now=this.d.now();
  if(hold.status!=="held")return this.afterLostRace(hold.hostId,input.idempotencyKey,c,fail("hold_not_found",MESSAGES.expired));
  if(Date.parse(hold.holdExpiresAt!)<=now.getTime())return fail("hold_expired",MESSAGES.expired);
  const slot={start:hold.start,end:hold.end};
  if(!isOfferedSlot({policy:c.host.policy,now,slot,busy:[]})){await this.d.store.releaseHold(hold.id,now);return fail("slot_unavailable",MESSAGES.slot)}
  // Step 6: live re-check against the calendar (and other DB rows, for buffer races) immediately before committing.
  const needed=bufferedInterval(slot,c.host.policy);
  let busy:TimeInterval[];
  try{busy=await c.adapter.getBusy(c.calendar,needed)}catch(err){this.log("confirm.recheck_failed",{bookingId:hold.id,error:describe(err)});return fail("calendar_unavailable",MESSAGES.calendar,true)}
  busy=busy.concat(await this.d.store.occupiedIntervals(c.host.id,needed,now,[hold.id]));
  if(overlapsAny(needed,busy)){await this.d.store.releaseHold(hold.id,now);this.log("confirm.recheck_conflict",{bookingId:hold.id});return fail("slot_unavailable",MESSAGES.slot)}
  // Step 7: atomic hold → booking.
  const converted=await this.d.store.convertHold({holdId:hold.id,now:this.d.now(),idempotencyKey:input.idempotencyKey,visitorName:input.visitorName,visitorEmail:input.visitorEmail,visitorTimezone:input.visitorTimezone,notes:input.notes?.trim()||null,title:`${input.visitorName} and ${c.host.displayName}`});
  if(!converted.ok)return this.afterLostRace(hold.hostId,input.idempotencyKey,c,fail(converted.reason==="hold_expired"?"hold_expired":"hold_not_found",MESSAGES.expired));
  return this.deliver(converted.booking,c.host,c.calendar,c.adapter,false);
 }

 /** A concurrent request with the same key may have converted the hold first: answer with its booking. */
 private async afterLostRace(hostId:string,key:string,c:{host:Host;calendar:CalendarAccount;adapter:CalendarAdapter},otherwise:Failure){
  const dup=await this.d.store.findByIdempotencyKey(hostId,key);
  return dup?this.resume(dup,c.host,c.calendar,c.adapter):otherwise;
 }

 /** Idempotent replay of a booking that already exists for this key. */
 private async resume(b:BookingRecord,host:Host,calendar:CalendarAccount,adapter:CalendarAdapter):Promise<BookingOutcome|Failure>{
  switch(b.status){
   case "confirmed":return{ok:true,outcome:"confirmed",duplicate:true,booking:this.view(b,host),manageUrl:this.d.manageUrl(b.id)};
   case "needs_reconciliation":return this.deliver(b,host,calendar,adapter,true);
   case "pending_event":
    if(this.d.now().getTime()-Date.parse(b.updatedAt)>=(this.d.staleAfterMs??60_000))return this.deliver(b,host,calendar,adapter,true);
    return fail("in_progress","Your booking is being confirmed. Please wait a moment.",true);
   case "failed":return fail("provider_failed",MESSAGES.provider);
   case "cancelled":return fail("not_allowed","This booking was cancelled.");
   default:return fail("hold_not_found",MESSAGES.expired);
  }
 }

 /** Steps 8–10 with compensation. Event creation is idempotent per booking id, so retries never duplicate. */
 private async deliver(b:BookingRecord,host:Host,calendar:CalendarAccount,adapter:CalendarAdapter,duplicate:boolean):Promise<BookingOutcome|Failure>{
  const manageUrl=this.d.manageUrl(b.id);
  // On a first attempt a definite provider error proves no event exists. On a retry an earlier, ambiguous attempt
  // may have created one, so the outcome stays "needs reconciliation" instead of releasing the slot.
  let eventMayExist=duplicate;
  try{
   let event=await adapter.createEvent(calendar,{bookingId:b.id,hostId:b.hostId,visitorName:b.visitorName??"",visitorEmail:b.visitorEmail??"",title:b.title??"Meeting",start:b.start,end:b.end,timezone:b.visitorTimezone??host.policy.timezone,notes:b.notes??undefined,manageUrl,idempotencyKey:b.idempotencyKey??b.id});
   // Event from an earlier attempt: make sure the calendar matches the DB time (e.g. after an interrupted reschedule).
   if(event.alreadyExisted){eventMayExist=true;event=await adapter.rescheduleEvent(calendar,{bookingId:b.id,externalEventId:event.externalEventId},{start:b.start,end:b.end})}
   const done=await this.d.store.transition(b.id,["pending_event","needs_reconciliation"],{status:"confirmed",now:this.d.now(),externalEventId:event.externalEventId,externalEventUrl:event.htmlUrl??null,failureReason:null});
   const final=done??await this.d.store.get(b.id);
   if(!final||final.status!=="confirmed"){this.log("deliver.state_changed",{bookingId:b.id,status:final?.status});return fail("not_allowed","This booking can no longer be confirmed.")}
   this.log("booking.confirmed",{bookingId:b.id,hostId:b.hostId,duplicate});
   return{ok:true,outcome:"confirmed",duplicate,booking:this.view(final,host),manageUrl};
  }catch(err){
   if(err instanceof CalendarProviderError&&err.definitelyNotApplied&&!eventMayExist){
    // Compensation: the calendar certainly has no event → release the slot and say so.
    await this.d.store.transition(b.id,["pending_event","needs_reconciliation"],{status:"failed",now:this.d.now(),failureReason:err.message});
    this.log("booking.failed",{bookingId:b.id,error:describe(err)});
    return fail("provider_failed",MESSAGES.provider,err.kind==="rate_limited");
   }
   // Unknown outcome: keep the slot reserved and mark for reconciliation (visitor retry or host action).
   const r=await this.d.store.transition(b.id,["pending_event","needs_reconciliation"],{status:"needs_reconciliation",now:this.d.now(),failureReason:describe(err)});
   this.log("booking.needs_reconciliation",{bookingId:b.id,error:describe(err)});
   return{ok:true,outcome:"needs_reconciliation",duplicate,booking:this.view(r??b,host),manageUrl};
  }
 }

 async getBooking(bookingId:string){
  const b=await this.d.store.get(bookingId);if(!b||!b.visitorEmail)return null;
  const ctx=await this.d.hosts.getById(b.hostId);if(!ctx)return null;
  return{booking:this.view(b,ctx.host),calendarConnected:Boolean(ctx.calendar)};
 }

 /** Host-initiated retry for needs_reconciliation / stuck pending_event bookings. */
 async reconcile(bookingId:string,hostId:string){
  const b=await this.d.store.get(bookingId);if(!b||b.hostId!==hostId)return fail("booking_not_found","Booking not found.");
  if(b.status!=="needs_reconciliation"&&b.status!=="pending_event")return fail("not_allowed","Only unconfirmed bookings can be retried.");
  const c=await this.connected(await this.d.hosts.getById(hostId));if(!c.ok)return c;
  return this.deliver(b,c.host,c.calendar,c.adapter,true);
 }

 /** Calendar first, then DB: a booking is only marked cancelled once the calendar event is gone. */
 async cancel(bookingId:string,actor:{hostId?:string}={}):Promise<{ok:true;booking:BookingView}|Failure>{
  const b=await this.d.store.get(bookingId);
  if(!b||!b.visitorEmail||(actor.hostId&&b.hostId!==actor.hostId))return fail("booking_not_found","Booking not found.");
  const c=await this.connected(await this.d.hosts.getById(b.hostId));
  if(b.status==="cancelled"&&c.ok)return{ok:true,booking:this.view(b,c.host)};
  if(!c.ok)return c;
  if(!["confirmed","needs_reconciliation","pending_event"].includes(b.status))return fail("not_allowed","This booking can't be cancelled.");
  try{await c.adapter.cancelEvent(c.calendar,{bookingId:b.id,externalEventId:b.externalEventId})}
  catch(err){this.log("cancel.provider_error",{bookingId:b.id,error:describe(err)});return fail("provider_failed","The calendar couldn't be updated. Your booking is unchanged; please try again.",true)}
  const done=await this.d.store.transition(b.id,["confirmed","needs_reconciliation","pending_event"],{status:"cancelled",now:this.d.now()});
  this.log("booking.cancelled",{bookingId:b.id,byHost:Boolean(actor.hostId)});
  return{ok:true,booking:this.view(done??{...b,status:"cancelled"},c.host)};
 }

 /** Moves a booking onto a new hold. The old slot is released by the same DB transaction that claims the new one. */
 async reschedule(bookingId:string,holdId:string):Promise<BookingOutcome|Failure>{
  const b=await this.d.store.get(bookingId);if(!b||!b.visitorEmail)return fail("booking_not_found","Booking not found.");
  if(b.status!=="confirmed"&&b.status!=="needs_reconciliation")return fail("not_allowed","This booking can't be rescheduled.");
  const hold=await this.d.store.get(holdId);
  if(!hold||hold.hostId!==b.hostId||hold.status!=="held")return fail("hold_not_found",MESSAGES.expired);
  const c=await this.connected(await this.d.hosts.getById(b.hostId));if(!c.ok)return c;
  const now=this.d.now();
  if(Date.parse(hold.holdExpiresAt!)<=now.getTime())return fail("hold_expired",MESSAGES.expired);
  const slot={start:hold.start,end:hold.end};const needed=bufferedInterval(slot,c.host.policy);
  if(!isOfferedSlot({policy:c.host.policy,now,slot,busy:[]})){await this.d.store.releaseHold(hold.id,now);return fail("slot_unavailable",MESSAGES.slot)}
  let busy:TimeInterval[];
  try{busy=await c.adapter.getBusy(c.calendar,needed)}catch(err){this.log("reschedule.recheck_failed",{bookingId:b.id,error:describe(err)});return fail("calendar_unavailable",MESSAGES.calendar,true)}
  // The booking's own event shows as busy; ignore exactly its current interval.
  busy=subtractInterval(busy,{start:b.start,end:b.end}).concat(await this.d.store.occupiedIntervals(c.host.id,needed,now,[hold.id,b.id]));
  if(overlapsAny(needed,busy)){await this.d.store.releaseHold(hold.id,now);return fail("slot_unavailable",MESSAGES.slot)}
  try{await c.adapter.rescheduleEvent(c.calendar,{bookingId:b.id,externalEventId:b.externalEventId},slot)}
  catch(err){
   if(err instanceof CalendarProviderError&&err.definitelyNotApplied){await this.d.store.releaseHold(hold.id,this.d.now());this.log("reschedule.failed",{bookingId:b.id,error:describe(err)});return fail("provider_failed","The calendar couldn't be updated. Your original time is unchanged.",err.kind==="rate_limited")}
   // Unknown: keep the hold so a retry can finish; if abandoned, reconciliation restores the DB time on the calendar.
   await this.d.store.transition(b.id,["confirmed","needs_reconciliation"],{status:"needs_reconciliation",now:this.d.now(),failureReason:`reschedule unconfirmed: ${describe(err)}`});
   return fail("provider_failed","We couldn't confirm the change with the calendar. Please try again.",true);
  }
  const moved=await this.d.store.moveToHold(b.id,hold.id,this.d.now());
  if(!moved.ok){
   // Calendar moved but DB didn't: flag so reconciliation puts the calendar back to the DB time.
   await this.d.store.transition(b.id,["confirmed","needs_reconciliation"],{status:"needs_reconciliation",now:this.d.now(),failureReason:`reschedule DB move failed: ${moved.reason}`});
   this.log("reschedule.db_move_failed",{bookingId:b.id,reason:moved.reason});
   return fail(moved.reason==="hold_expired"?"hold_expired":"slot_unavailable",moved.reason==="hold_expired"?MESSAGES.expired:MESSAGES.slot);
  }
  this.log("booking.rescheduled",{bookingId:b.id});
  return{ok:true,outcome:"confirmed",duplicate:false,booking:this.view(moved.booking,c.host),manageUrl:this.d.manageUrl(b.id)};
 }

 async listForHost(hostId:string,limit=50){const ctx=await this.d.hosts.getById(hostId);if(!ctx)return[];return(await this.d.store.listForHost(hostId,new Date(this.d.now().getTime()-86_400_000),limit)).map(b=>this.view(b,ctx.host))}
}

/** Error summary safe for logs and DB: provider error messages carry status codes only, never tokens. */
export function describe(err:unknown){return err instanceof CalendarProviderError?`${err.kind}: ${err.message}`:err instanceof Error?err.name:"unknown error"}
