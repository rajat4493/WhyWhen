import {describe,expect,it} from "vitest";
import {CalendarProviderError} from "../src/core/integrations/calendar/adapter";
import {GoogleCalendarAdapter,googleEventId} from "../src/core/integrations/calendar/google";
import {ACCOUNT} from "./fakes";

type Call={url:string;method:string;body:unknown;auth:string|null};
function fakeFetch(responses:Array<Response|Error>){
 const calls:Call[]=[];
 const impl=(async(url:string|URL|Request,init?:RequestInit)=>{
  calls.push({url:String(url),method:init?.method??"GET",body:init?.body?JSON.parse(String(init.body)):undefined,auth:new Headers(init?.headers).get("authorization")});
  const r=responses.shift();if(!r)throw new Error("unexpected request");if(r instanceof Error)throw r;return r;
 }) as typeof fetch;
 return{impl,calls};
}
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const creds={accessToken:async()=>"access-token"};
const BOOKING_ID="3f2b8c1e-9a4d-4c6e-8b1f-0a2b3c4d5e6f";
const draft={bookingId:BOOKING_ID,hostId:"host-1",visitorName:"Ada",visitorEmail:"ada@example.com",title:"Ada and Rajat",start:"2026-10-19T10:00:00.000Z",end:"2026-10-19T10:30:00.000Z",timezone:"Europe/Warsaw",notes:"Context",manageUrl:"https://app/manage/x",idempotencyKey:"k"};

describe("GoogleCalendarAdapter",()=>{
 it("derives a valid deterministic base32hex event id from the booking id",()=>{
  const id=googleEventId({bookingId:BOOKING_ID});
  expect(id).toMatch(/^[0-9a-v]{5,1024}$/);expect(id).toBe("3f2b8c1e9a4d4c6e8b1f0a2b3c4d5e6f");
 });
 it("creates the event with the deterministic id, attendee, invite updates and manage link",async()=>{
  const f=fakeFetch([json(200,{id:"3f2b8c1e9a4d4c6e8b1f0a2b3c4d5e6f",htmlLink:"https://cal/e"})]);
  const r=await new GoogleCalendarAdapter(creds,f.impl).createEvent(ACCOUNT,draft);
  expect(r).toEqual({externalEventId:"3f2b8c1e9a4d4c6e8b1f0a2b3c4d5e6f",htmlUrl:"https://cal/e",meetingUrl:undefined,alreadyExisted:false});
  expect(f.calls[0].url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all");
  expect(f.calls[0].auth).toBe("Bearer access-token");
  expect(f.calls[0].body).toMatchObject({id:"3f2b8c1e9a4d4c6e8b1f0a2b3c4d5e6f",attendees:[{email:"ada@example.com"}],start:{dateTime:draft.start,timeZone:"UTC"}});
  expect((f.calls[0].body as {description:string}).description).toContain("https://app/manage/x");
 });
 it("409 duplicate id → returns the existing event (idempotent retry)",async()=>{
  const f=fakeFetch([json(409,{error:{errors:[{reason:"duplicate"}]}}),json(200,{id:"abc",status:"confirmed"})]);
  expect(await new GoogleCalendarAdapter(creds,f.impl).createEvent(ACCOUNT,draft)).toMatchObject({externalEventId:"abc",alreadyExisted:true});
  expect(f.calls[1].method).toBe("GET");
 });
 it("409 for an event the host deleted → rejected, not silently confirmed",async()=>{
  const f=fakeFetch([json(409,{}),json(200,{id:"abc",status:"cancelled"})]);
  await expect(new GoogleCalendarAdapter(creds,f.impl).createEvent(ACCOUNT,draft)).rejects.toMatchObject({kind:"rejected"});
 });
 it.each([[401,"auth"],[403,"rejected"],[404,"not_found"],[429,"rate_limited"],[500,"unavailable"],[503,"unavailable"]] as const)("maps HTTP %i on create to %s",async(status,kind)=>{
  const f=fakeFetch([json(status,{error:{errors:[{reason:"x"}]}})]);
  const err=await new GoogleCalendarAdapter(creds,f.impl).createEvent(ACCOUNT,draft).catch(e=>e);
  expect(err).toBeInstanceOf(CalendarProviderError);expect(err.kind).toBe(kind);
  expect(err.definitelyNotApplied).toBe(kind!=="unavailable");
 });
 it("403 rateLimitExceeded is rate_limited",async()=>{
  const f=fakeFetch([json(403,{error:{errors:[{reason:"rateLimitExceeded"}]}})]);
  await expect(new GoogleCalendarAdapter(creds,f.impl).getBusy(ACCOUNT,{start:"a",end:"b"})).rejects.toMatchObject({kind:"rate_limited"});
 });
 it("network error/timeout → unavailable (outcome unknown)",async()=>{
  const f=fakeFetch([new TypeError("fetch failed")]);
  await expect(new GoogleCalendarAdapter(creds,f.impl).createEvent(ACCOUNT,draft)).rejects.toMatchObject({kind:"unavailable"});
 });
 it("normalizes free/busy and surfaces calendar-level errors",async()=>{
  const f=fakeFetch([json(200,{calendars:{primary:{busy:[{start:"2026-10-19T12:00:00+02:00",end:"2026-10-19T13:00:00+02:00"}]}}}),json(200,{calendars:{primary:{errors:[{reason:"notFound"}]}}})]);
  const a=new GoogleCalendarAdapter(creds,f.impl);
  expect(await a.getBusy(ACCOUNT,{start:"2026-10-19T00:00:00Z",end:"2026-10-20T00:00:00Z"})).toEqual([{start:"2026-10-19T10:00:00.000Z",end:"2026-10-19T11:00:00.000Z"}]);
  expect(f.calls[0].body).toMatchObject({items:[{id:"primary"}]});
  await expect(a.getBusy(ACCOUNT,{start:"x",end:"y"})).rejects.toMatchObject({kind:"not_found"});
 });
 it("reschedule PATCHes start/end; cancel treats 410/404 as success",async()=>{
  const f=fakeFetch([json(200,{id:"e1"}),new Response(null,{status:410}),new Response(null,{status:404}),new Response(null,{status:204})]);
  const a=new GoogleCalendarAdapter(creds,f.impl);
  await a.rescheduleEvent(ACCOUNT,{bookingId:BOOKING_ID,externalEventId:"e1"},{start:"2026-10-19T11:00:00.000Z",end:"2026-10-19T11:30:00.000Z"});
  expect(f.calls[0]).toMatchObject({method:"PATCH",body:{start:{dateTime:"2026-10-19T11:00:00.000Z"}}});
  await a.cancelEvent(ACCOUNT,{bookingId:BOOKING_ID});await a.cancelEvent(ACCOUNT,{bookingId:BOOKING_ID});await a.cancelEvent(ACCOUNT,{bookingId:BOOKING_ID,externalEventId:"e1"});
  expect(f.calls[1].url).toContain("/events/3f2b8c1e9a4d4c6e8b1f0a2b3c4d5e6f?sendUpdates=all");
 });
 it("lists only owned calendars as writable",async()=>{
  const f=fakeFetch([json(200,{items:[{id:"primary@x",summary:"Me",primary:true,timeZone:"Europe/Warsaw",accessRole:"owner"},{id:"team",summary:"Team",accessRole:"reader"}]})]);
  expect(await new GoogleCalendarAdapter(creds,f.impl).listCalendars(ACCOUNT)).toEqual([{id:"primary@x",name:"Me",primary:true,timezone:"Europe/Warsaw",writable:true},{id:"team",name:"Team",primary:false,timezone:undefined,writable:false}]);
 });
});
