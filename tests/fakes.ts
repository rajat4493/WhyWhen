import {InMemoryBookingStore} from "../src/core/booking/memory-store";
import {BookingService} from "../src/core/booking/service";
import type {HostDirectory} from "../src/core/booking/store";
import type {AvailabilityPolicy,BookingDraft,CalendarAccount,HostContext,TimeInterval} from "../src/core/domain/types";
import {CalendarProviderError,type CalendarAdapter,type CalendarSummary,type CreatedCalendarEvent,type EventRef} from "../src/core/integrations/calendar/adapter";

export const UTC_POLICY:AvailabilityPolicy={timezone:"UTC",weekly:[1,2,3,4,5].map(d=>({weekday:d as 1,start:"09:00",end:"17:00"})),durationMinutes:30,bufferBeforeMinutes:0,bufferAfterMinutes:0,minimumNoticeMinutes:60,horizonDays:30};

export class FakeClock{constructor(public ms:number){} now=()=>new Date(this.ms); advance(minutes:number){this.ms+=minutes*60_000}}

type Failure=CalendarProviderError|Error;
/** In-memory Google-like calendar: idempotent create per bookingId, PATCH, DELETE; failures injectable per call. */
export class FakeCalendar implements CalendarAdapter{
 readonly provider="google" as const;
 events=new Map<string,{start:string;end:string;status:"confirmed"|"cancelled"}>();
 externalBusy:TimeInterval[]=[];
 calls={getBusy:0,create:0,reschedule:0,cancel:0};
 failNext:Partial<Record<"getBusy"|"create"|"reschedule"|"cancel",Failure>>={};
 /** Simulates a timeout that happens AFTER the provider applied the create. */
 applyThenTimeoutOnCreate=false;
 private take(op:keyof FakeCalendar["failNext"]){const e=this.failNext[op];if(e){delete this.failNext[op];throw e}}
 async listCalendars():Promise<CalendarSummary[]>{return[{id:"primary",name:"Primary",primary:true,timezone:"UTC",writable:true}]}
 async getBusy(_a:CalendarAccount,range:TimeInterval){this.calls.getBusy++;this.take("getBusy");
  const ours=[...this.events.values()].filter(e=>e.status==="confirmed");
  return[...this.externalBusy,...ours].filter(b=>Date.parse(b.start)<Date.parse(range.end)&&Date.parse(b.end)>Date.parse(range.start)).map(b=>({start:b.start,end:b.end}))}
 async createEvent(_a:CalendarAccount,b:BookingDraft):Promise<CreatedCalendarEvent>{this.calls.create++;this.take("create");
  const id=b.bookingId.replace(/-/g,"");const existing=this.events.get(id);
  if(existing)return{externalEventId:id,alreadyExisted:true};
  this.events.set(id,{start:b.start,end:b.end,status:"confirmed"});
  if(this.applyThenTimeoutOnCreate){this.applyThenTimeoutOnCreate=false;throw new CalendarProviderError("unavailable","google","timeout")}
  return{externalEventId:id,htmlUrl:`https://calendar.example/${id}`};
 }
 async rescheduleEvent(_a:CalendarAccount,ref:EventRef,slot:TimeInterval){this.calls.reschedule++;this.take("reschedule");
  const id=ref.externalEventId??ref.bookingId.replace(/-/g,"");const e=this.events.get(id);if(!e)throw new CalendarProviderError("not_found","google","404",404);
  this.events.set(id,{...e,...slot});return{externalEventId:id}}
 async cancelEvent(_a:CalendarAccount,ref:EventRef){this.calls.cancel++;this.take("cancel");const id=ref.externalEventId??ref.bookingId.replace(/-/g,"");const e=this.events.get(id);if(e)this.events.set(id,{...e,status:"cancelled"})}
 confirmedEvents(){return[...this.events.values()].filter(e=>e.status==="confirmed")}
}

export const ACCOUNT:CalendarAccount={id:"acc-1",hostId:"host-1",provider:"google",externalAccountId:"sub",email:"host@example.com",timezone:"UTC",credentialRef:"acc-1",calendarId:"primary"};
export function fakeHosts(policy=UTC_POLICY,connected=true):HostDirectory&{ctx:HostContext}{
 const ctx:HostContext={host:{id:"host-1",slug:"rajat",displayName:"Rajat",email:"host@example.com",policy},calendar:connected?ACCOUNT:null};
 return{ctx,getBySlug:async s=>s===ctx.host.slug?ctx:null,getById:async id=>id===ctx.host.id?ctx:null};
}

let seq=0;
export const uuid=()=>{seq++;return`00000000-0000-4000-8000-${String(seq).padStart(12,"0")}`};

/** Monday 2026-10-19 08:00 UTC: a working day with 09:00–17:00 ahead. */
export const MONDAY_8AM=Date.parse("2026-10-19T08:00:00.000Z");

export function harness(opts:{policy?:AvailabilityPolicy;store?:InMemoryBookingStore;connected?:boolean}={}){
 const clock=new FakeClock(MONDAY_8AM);const calendar=new FakeCalendar();const store=opts.store??new InMemoryBookingStore();const hosts=fakeHosts(opts.policy,opts.connected);
 const service=new BookingService({store,hosts,calendars:()=>calendar,now:clock.now,newId:uuid,manageUrl:id=>`https://app.test/manage/${id}.sig`,holdTtlSeconds:600,staleAfterMs:60_000});
 return{clock,calendar,store,hosts,service};
}
export const visitor=(key:string)=>({idempotencyKey:key,visitorName:"Ada Visitor",visitorEmail:"ada@example.com",visitorTimezone:"Europe/Warsaw"});
