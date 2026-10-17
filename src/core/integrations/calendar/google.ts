import type {BookingDraft,CalendarAccount,TimeInterval} from "../../domain/types";
import {CalendarProviderError,type CalendarAdapter,type CalendarSummary,type CreatedCalendarEvent,type CredentialResolver,type EventRef} from "./adapter";

const API="https://www.googleapis.com/calendar/v3";
const TIMEOUT_MS=10_000;
type GoogleEvent={id:string;status?:string;htmlLink?:string;hangoutLink?:string};

/** Google accepts client-chosen event IDs in base32hex (a–v, 0–9); a UUID's hex digits qualify. */
export function googleEventId(ref:EventRef){return ref.externalEventId??ref.bookingId.toLowerCase().replace(/[^0-9a-f]/g,"")}

export function eventDescription(booking:Pick<BookingDraft,"notes"|"manageUrl">){return[booking.notes?.trim(),booking.manageUrl?`Reschedule or cancel: ${booking.manageUrl}`:undefined].filter(Boolean).join("\n\n")}

export class GoogleCalendarAdapter implements CalendarAdapter{readonly provider="google" as const;
 constructor(private readonly credentials:CredentialResolver,private readonly fetchImpl:typeof fetch=fetch){}

 private async request(account:CalendarAccount,action:string,path:string,init:RequestInit={}):Promise<Response>{
  const token=await this.credentials.accessToken(account.credentialRef);
  try{return await this.fetchImpl(`${API}${path}`,{...init,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...init.headers},signal:AbortSignal.timeout(TIMEOUT_MS)})}
  catch{throw new CalendarProviderError("unavailable","google",`Google ${action}: network error or timeout`)}
 }
 private async fail(r:Response,action:string):Promise<never>{
  let reason="";try{const body=await r.json() as {error?:{errors?:Array<{reason?:string}>}};reason=body.error?.errors?.[0]?.reason??""}catch{/* non-JSON error body */}
  const kind=r.status===401?"auth":r.status===404||r.status===410?"not_found":r.status===429||/rateLimit/i.test(reason)?"rate_limited":r.status>=500?"unavailable":"rejected";
  throw new CalendarProviderError(kind,"google",`Google ${action} failed: ${r.status}${reason?` ${reason}`:""}`,r.status);
 }
 private calendarPath(account:CalendarAccount){return`/calendars/${encodeURIComponent(account.calendarId??"primary")}`}
 private toCreated(e:GoogleEvent,alreadyExisted=false):CreatedCalendarEvent{return{externalEventId:e.id,htmlUrl:e.htmlLink,meetingUrl:e.hangoutLink,alreadyExisted}}

 async listCalendars(account:CalendarAccount):Promise<CalendarSummary[]>{
  const r=await this.request(account,"calendar list","/users/me/calendarList?minAccessRole=owner&maxResults=250");if(!r.ok)await this.fail(r,"calendar list");
  const d=await r.json() as {items?:Array<{id:string;summary?:string;summaryOverride?:string;primary?:boolean;timeZone?:string;accessRole?:string}>};
  return(d.items??[]).map(c=>({id:c.id,name:c.summaryOverride??c.summary??c.id,primary:Boolean(c.primary),timezone:c.timeZone,writable:c.accessRole==="owner"||c.accessRole==="writer"}));
 }

 async getBusy(account:CalendarAccount,range:TimeInterval):Promise<TimeInterval[]>{
  const calendarId=account.calendarId??"primary";
  const r=await this.request(account,"free/busy","/freeBusy",{method:"POST",body:JSON.stringify({timeMin:range.start,timeMax:range.end,items:[{id:calendarId}]})});if(!r.ok)await this.fail(r,"free/busy");
  const d=await r.json() as {calendars?:Record<string,{busy?:TimeInterval[];errors?:Array<{reason?:string}>}>};
  const cal=d.calendars?.[calendarId];
  if(!cal)throw new CalendarProviderError("rejected","google","Google free/busy returned no data for the selected calendar");
  if(cal.errors?.length)throw new CalendarProviderError(cal.errors[0].reason==="notFound"?"not_found":"rejected","google",`Google free/busy calendar error: ${cal.errors[0].reason??"unknown"}`);
  return(cal.busy??[]).map(b=>({start:new Date(b.start).toISOString(),end:new Date(b.end).toISOString()}));
 }

 async createEvent(account:CalendarAccount,booking:BookingDraft):Promise<CreatedCalendarEvent>{
  const id=googleEventId({bookingId:booking.bookingId});
  const body={id,summary:booking.title,description:eventDescription(booking),start:{dateTime:booking.start,timeZone:account.timezone},end:{dateTime:booking.end,timeZone:account.timezone},attendees:[{email:booking.visitorEmail,displayName:booking.visitorName}],extendedProperties:{private:{bookingId:booking.bookingId}}};
  const r=await this.request(account,"event creation",`${this.calendarPath(account)}/events?sendUpdates=all`,{method:"POST",body:JSON.stringify(body)});
  if(r.ok)return this.toCreated(await r.json() as GoogleEvent);
  if(r.status!==409)await this.fail(r,"event creation");
  // 409: an event with our deterministic ID exists — a previous attempt succeeded.
  const existing=await this.request(account,"event lookup",`${this.calendarPath(account)}/events/${id}`);if(!existing.ok)await this.fail(existing,"event lookup");
  const event=await existing.json() as GoogleEvent;
  if(event.status==="cancelled")throw new CalendarProviderError("rejected","google","Google event for this booking was deleted in the calendar");
  return this.toCreated(event,true);
 }

 async rescheduleEvent(account:CalendarAccount,ref:EventRef,slot:TimeInterval):Promise<CreatedCalendarEvent>{
  const r=await this.request(account,"event reschedule",`${this.calendarPath(account)}/events/${encodeURIComponent(googleEventId(ref))}?sendUpdates=all`,{method:"PATCH",body:JSON.stringify({start:{dateTime:slot.start,timeZone:account.timezone},end:{dateTime:slot.end,timeZone:account.timezone}})});
  if(!r.ok)await this.fail(r,"event reschedule");
  return this.toCreated(await r.json() as GoogleEvent);
 }

 async cancelEvent(account:CalendarAccount,ref:EventRef):Promise<void>{
  const r=await this.request(account,"event cancellation",`${this.calendarPath(account)}/events/${encodeURIComponent(googleEventId(ref))}?sendUpdates=all`,{method:"DELETE"});
  if(!r.ok&&r.status!==404&&r.status!==410)await this.fail(r,"event cancellation");
 }
}
