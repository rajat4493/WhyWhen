import {describe,expect,it,vi} from "vitest";
import {CalendarProviderError} from "../src/core/integrations/calendar/adapter";
import {decideIntent} from "../src/core/ai/registry";
import {UTC_POLICY,harness,visitor} from "./fakes";

const TEN="2026-10-19T10:00:00.000Z",ELEVEN="2026-10-19T11:00:00.000Z";
const ok=<T extends {ok:boolean}>(r:T)=>{if(!r.ok)throw new Error(`expected ok, got ${JSON.stringify(r)}`);return r as Extract<T,{ok:true}>};

async function book(h:ReturnType<typeof harness>,start=TEN,key="key-aaaaaaaaaaaaaaaa"){
 const hold=ok(await h.service.createHold("rajat",start));
 return{hold,result:await h.service.confirm({holdId:hold.holdId,...visitor(key)})};
}

describe("BookingService — happy path",()=>{
 it("lists slots, holds, re-checks, converts, creates event, confirms",async()=>{
  const h=harness();
  const slots=ok(await h.service.listSlots("rajat",{start:"2026-10-19T00:00:00Z",end:"2026-10-20T00:00:00Z"}));
  expect(slots.slots[0].start).toBe("2026-10-19T09:00:00.000Z");
  const {hold,result}=await book(h);
  const r=ok(result);
  expect(r.outcome).toBe("confirmed");expect(r.duplicate).toBe(false);
  expect(h.calendar.calls.getBusy).toBe(2);// listing + step-6 re-check
  expect(h.calendar.confirmedEvents()).toEqual([{start:TEN,end:"2026-10-19T10:30:00.000Z",status:"confirmed"}]);
  const row=await h.store.get(hold.holdId);
  expect(row).toMatchObject({status:"confirmed",externalEventId:hold.holdId.replace(/-/g,""),visitorEmail:"ada@example.com",visitorTimezone:"Europe/Warsaw"});
  expect(r.manageUrl).toContain(hold.holdId);
 });
 it("never exposes busy-event details, only free slots",async()=>{
  const h=harness();h.calendar.externalBusy=[{start:TEN,end:ELEVEN}];
  const r=ok(await h.service.listSlots("rajat",{start:"2026-10-19T00:00:00Z",end:"2026-10-20T00:00:00Z"}));
  expect(Object.keys(r).sort()).toEqual(["durationMinutes","hostTimezone","ok","slots"]);
  expect(r.slots.map(s=>s.start)).not.toContain(TEN);
 });
 it("rejects slots outside policy",async()=>{
  const h=harness();
  expect(await h.service.createHold("rajat","2026-10-19T10:10:00.000Z")).toMatchObject({ok:false,code:"invalid_slot"});
  expect(await h.service.createHold("rajat","2026-10-19T08:30:00.000Z")).toMatchObject({ok:false,code:"invalid_slot"});// before notice / hours
 });
 it("pauses booking when the calendar is disconnected",async()=>{
  const h=harness({connected:false});
  expect(await h.service.createHold("rajat",TEN)).toMatchObject({ok:false,code:"calendar_not_connected"});
 });
});

describe("BookingService — races, holds, idempotency",()=>{
 it("two visitors racing for the same slot: exactly one hold wins",async()=>{
  const h=harness();
  const [a,b]=await Promise.all([h.service.createHold("rajat",TEN),h.service.createHold("rajat",TEN)]);
  expect([a.ok,b.ok].sort()).toEqual([false,true]);
  expect([a,b].find(x=>!x.ok)).toMatchObject({code:"slot_unavailable"});
 });
 it("re-check catches a calendar event added after the hold and releases the hold",async()=>{
  const h=harness();
  const hold=ok(await h.service.createHold("rajat",TEN));
  h.calendar.externalBusy=[{start:"2026-10-19T10:15:00Z",end:ELEVEN}];
  expect(await h.service.confirm({holdId:hold.holdId,...visitor("key-recheck-000000001")})).toMatchObject({ok:false,code:"slot_unavailable"});
  expect((await h.store.get(hold.holdId))?.status).toBe("released");
  expect(h.calendar.calls.create).toBe(0);
 });
 it("expired holds cannot be confirmed and free the slot for others",async()=>{
  const h=harness();
  const hold=ok(await h.service.createHold("rajat",TEN));
  h.clock.advance(11);
  expect(await h.service.confirm({holdId:hold.holdId,...visitor("key-expired-00000001")})).toMatchObject({ok:false,code:"hold_expired"});
  expect((await h.service.createHold("rajat",TEN)).ok).toBe(true);
  expect(h.calendar.calls.create).toBe(0);
 });
 it("an unexpired hold blocks other visitors",async()=>{
  const h=harness();ok(await h.service.createHold("rajat",TEN));h.clock.advance(9);
  expect(await h.service.createHold("rajat",TEN)).toMatchObject({ok:false,code:"slot_unavailable"});
 });
 it("duplicate submission with the same key returns the same booking and creates one event",async()=>{
  const h=harness();
  const {hold,result}=await book(h);ok(result);
  const again=ok(await h.service.confirm({holdId:hold.holdId,...visitor("key-aaaaaaaaaaaaaaaa")}));
  expect(again).toMatchObject({outcome:"confirmed",duplicate:true});
  expect(again.booking.id).toBe(hold.holdId);
  expect(h.calendar.calls.create).toBe(1);
 });
 it("concurrent double-click: one event, the other request is told to wait or gets the same booking",async()=>{
  const h=harness();
  const hold=ok(await h.service.createHold("rajat",TEN));
  const [a,b]=await Promise.all([h.service.confirm({holdId:hold.holdId,...visitor("key-double-click-0001")}),h.service.confirm({holdId:hold.holdId,...visitor("key-double-click-0001")})]);
  expect(h.calendar.confirmedEvents()).toHaveLength(1);
  const outcomes=[a,b].map(r=>r.ok?r.outcome:r.code).sort();
  expect(outcomes[0]).toBe("confirmed");
  expect(["confirmed","in_progress"]).toContain(outcomes[1]);
 });
 it("a different key cannot reuse a converted hold",async()=>{
  const h=harness();const {hold}=await book(h);
  expect(await h.service.confirm({holdId:hold.holdId,...visitor("key-other-000000000001")})).toMatchObject({ok:false,code:"hold_not_found"});
 });
});

describe("BookingService — provider failures and compensation",()=>{
 it("availability fails closed when free/busy is unavailable",async()=>{
  const h=harness();h.calendar.failNext.getBusy=new CalendarProviderError("unavailable","google","503",503);
  expect(await h.service.listSlots("rajat",{start:"2026-10-19T00:00:00Z",end:"2026-10-20T00:00:00Z"})).toMatchObject({ok:false,code:"calendar_unavailable",retryable:true});
 });
 it("re-check failure keeps the hold so the visitor can retry",async()=>{
  const h=harness();const hold=ok(await h.service.createHold("rajat",TEN));
  h.calendar.failNext.getBusy=new CalendarProviderError("unavailable","google","timeout");
  expect(await h.service.confirm({holdId:hold.holdId,...visitor("key-recheck-fail-0001")})).toMatchObject({ok:false,code:"calendar_unavailable"});
  expect((await h.store.get(hold.holdId))?.status).toBe("held");
  ok(await h.service.confirm({holdId:hold.holdId,...visitor("key-recheck-fail-0001")}));
 });
 it("definite event-creation failure → failed, slot released, never reported as booked",async()=>{
  const h=harness();h.calendar.failNext.create=new CalendarProviderError("rejected","google","400",400);
  const {hold,result}=await book(h);
  expect(result).toMatchObject({ok:false,code:"provider_failed"});
  expect((await h.store.get(hold.holdId))?.status).toBe("failed");
  expect((await h.service.createHold("rajat",TEN)).ok).toBe(true);
 });
 it("revoked OAuth during booking → failed (auth is definite)",async()=>{
  const h=harness();h.calendar.failNext.create=new CalendarProviderError("auth","google","revoked");
  expect((await book(h)).result).toMatchObject({ok:false,code:"provider_failed"});
 });
 it("partial failure: event applied but response lost → needs_reconciliation; retry confirms without duplicating",async()=>{
  const h=harness();h.calendar.applyThenTimeoutOnCreate=true;
  const {hold,result}=await book(h,TEN,"key-partial-000000001");
  expect(ok(result).outcome).toBe("needs_reconciliation");
  expect((await h.store.get(hold.holdId))?.status).toBe("needs_reconciliation");
  expect(await h.service.createHold("rajat",TEN)).toMatchObject({ok:false,code:"slot_unavailable"});// slot stays reserved
  const retry=ok(await h.service.confirm({holdId:hold.holdId,...visitor("key-partial-000000001")}));
  expect(retry.outcome).toBe("confirmed");
  expect(h.calendar.confirmedEvents()).toHaveLength(1);
  expect((await h.store.get(hold.holdId))?.status).toBe("confirmed");
 });
 it("event created but DB write of the event id fails → needs_reconciliation; retry confirms one event",async()=>{
  const h=harness();
  vi.spyOn(h.store,"transition").mockImplementationOnce(async()=>{throw new Error("db down")});
  const hold=ok(await h.service.createHold("rajat",TEN));
  expect(ok(await h.service.confirm({holdId:hold.holdId,...visitor("key-db-fail-000000001")})).outcome).toBe("needs_reconciliation");
  expect(ok(await h.service.confirm({holdId:hold.holdId,...visitor("key-db-fail-000000001")})).outcome).toBe("confirmed");
  expect(h.calendar.calls.create).toBe(2);expect(h.calendar.confirmedEvents()).toHaveLength(1);
 });
 it("crash between event creation and any DB write → stale pending_event is resumed safely",async()=>{
  const h=harness();
  const spy=vi.spyOn(h.store,"transition").mockImplementation(async()=>{throw new Error("db down")});
  const hold=ok(await h.service.createHold("rajat",TEN));
  await expect(h.service.confirm({holdId:hold.holdId,...visitor("key-crash-00000000001")})).rejects.toThrow("db down");
  spy.mockRestore();
  expect((await h.store.get(hold.holdId))?.status).toBe("pending_event");
  expect(await h.service.confirm({holdId:hold.holdId,...visitor("key-crash-00000000001")})).toMatchObject({ok:false,code:"in_progress"});
  h.clock.advance(2);
  expect(ok(await h.service.confirm({holdId:hold.holdId,...visitor("key-crash-00000000001")})).outcome).toBe("confirmed");
  expect(h.calendar.confirmedEvents()).toHaveLength(1);
 });
 it("definite error on a RETRY keeps the slot reserved (an earlier attempt may have created the event)",async()=>{
  const h=harness();h.calendar.applyThenTimeoutOnCreate=true;
  const {hold}=await book(h,TEN,"key-retry-auth-000001");
  h.calendar.failNext.create=new CalendarProviderError("auth","google","revoked");
  expect(ok(await h.service.confirm({holdId:hold.holdId,...visitor("key-retry-auth-000001")})).outcome).toBe("needs_reconciliation");
  expect((await h.store.get(hold.holdId))?.status).toBe("needs_reconciliation");
  expect(await h.service.createHold("rajat",TEN)).toMatchObject({ok:false,code:"slot_unavailable"});
 });
 it("host reconcile retries an unconfirmed booking",async()=>{
  const h=harness();h.calendar.failNext.create=new CalendarProviderError("unavailable","google","503",503);
  const {hold}=await book(h,TEN,"key-reconcile-0000001");
  expect(await h.service.reconcile(hold.holdId,"someone-else")).toMatchObject({ok:false,code:"booking_not_found"});
  expect(ok(await h.service.reconcile(hold.holdId,"host-1")).outcome).toBe("confirmed");
 });
});

describe("BookingService — cancel and reschedule",()=>{
 it("cancellation removes the calendar event, then marks cancelled; repeat is idempotent",async()=>{
  const h=harness();const {hold}=await book(h);
  ok(await h.service.cancel(hold.holdId));
  expect(h.calendar.confirmedEvents()).toHaveLength(0);
  expect((await h.store.get(hold.holdId))?.status).toBe("cancelled");
  ok(await h.service.cancel(hold.holdId));
  expect((await h.service.createHold("rajat",TEN)).ok).toBe(true);// slot freed
 });
 it("calendar failure during cancel leaves the booking unchanged",async()=>{
  const h=harness();const {hold}=await book(h);h.calendar.failNext.cancel=new CalendarProviderError("unavailable","google","503",503);
  expect(await h.service.cancel(hold.holdId)).toMatchObject({ok:false,code:"provider_failed"});
  expect((await h.store.get(hold.holdId))?.status).toBe("confirmed");
 });
 it("hosts can only cancel their own bookings",async()=>{
  const h=harness();const {hold}=await book(h);
  expect(await h.service.cancel(hold.holdId,{hostId:"host-2"})).toMatchObject({ok:false,code:"booking_not_found"});
 });
 it("reschedule moves the event and releases the old slot",async()=>{
  const h=harness();const {hold}=await book(h);
  const newHold=ok(await h.service.createHold("rajat",ELEVEN));
  const r=ok(await h.service.reschedule(hold.holdId,newHold.holdId));
  expect(r.booking).toMatchObject({start:ELEVEN,status:"confirmed"});
  expect(h.calendar.confirmedEvents()).toEqual([{start:ELEVEN,end:"2026-10-19T11:30:00.000Z",status:"confirmed"}]);
  expect((await h.store.get(newHold.holdId))?.status).toBe("consumed");
  expect((await h.service.createHold("rajat",TEN)).ok).toBe(true);// old slot released
 });
 it("reschedule to an adjacent slot ignores the booking's own busy block inside the buffer",async()=>{
  const h=harness({policy:{...UTC_POLICY,bufferBeforeMinutes:15}});
  const {hold}=await book(h,TEN,"key-adjacent-00000001");
  const n=ok(await h.service.createHold("rajat","2026-10-19T10:30:00.000Z"));
  expect(ok(await h.service.reschedule(hold.holdId,n.holdId)).booking.start).toBe("2026-10-19T10:30:00.000Z");
 });
 it("a new visitor cannot take a slot inside another booking's buffer",async()=>{
  const h=harness({policy:{...UTC_POLICY,bufferBeforeMinutes:15}});
  await book(h,TEN,"key-buffer-a-00000001");
  const n=ok(await h.service.createHold("rajat","2026-10-19T10:30:00.000Z"));
  expect(await h.service.confirm({holdId:n.holdId,...visitor("key-buffer-b-00000001")})).toMatchObject({ok:false,code:"slot_unavailable"});
 });
 it("V0 limitation: rescheduling onto a time that overlaps the current booking is rejected cleanly",async()=>{
  const h=harness({policy:{...UTC_POLICY,durationMinutes:60}});
  await book(h,TEN,"key-overlap-000000001");
  expect(await h.service.createHold("rajat","2026-10-19T10:30:00.000Z")).toMatchObject({ok:false,code:"slot_unavailable"});
 });
 it("definite calendar failure on reschedule keeps the original time and frees the new hold",async()=>{
  const h=harness();const {hold}=await book(h);const n=ok(await h.service.createHold("rajat",ELEVEN));
  h.calendar.failNext.reschedule=new CalendarProviderError("rejected","google","400",400);
  expect(await h.service.reschedule(hold.holdId,n.holdId)).toMatchObject({ok:false,code:"provider_failed"});
  expect((await h.store.get(hold.holdId))?.start).toBe(TEN);
  expect((await h.store.get(n.holdId))?.status).toBe("released");
 });
});

describe("AI is not on the booking path",()=>{
 it("AI provider unavailable while direct booking still confirms",async()=>{
  await expect(decideIntent("Can we have a call?",{mode:"openai-compatible"})).rejects.toThrow();
  await expect(decideIntent("Can we have a call?",{mode:"gateway"})).rejects.toThrow();
  const h=harness();
  expect(ok((await book(h,TEN,"key-no-ai-00000000001")).result).outcome).toBe("confirmed");
 });
 it("intent endpoint degrades calmly and points to direct booking",async()=>{
  const prev=process.env.AI_MODE;process.env.AI_MODE="openai-compatible";
  try{
   const {POST}=await import("../src/app/api/intent/route");
   const r=await POST(new Request("http://x/api/intent",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({intent:"Can we talk?"})}));
   expect(await r.json()).toMatchObject({degraded:true,message:expect.stringContaining("Direct booking remains available")});
  }finally{process.env.AI_MODE=prev}
 });
});
