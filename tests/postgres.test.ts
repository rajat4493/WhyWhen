import {readdirSync,readFileSync} from "node:fs";
import {randomBytes,randomUUID} from "node:crypto";
import {afterAll,beforeAll,beforeEach,describe,expect,it} from "vitest";
import type {Pool} from "pg";
import {BookingService} from "../src/core/booking/service";
import {createPool} from "../src/server/db/postgres";
import {PostgresBookingStore} from "../src/server/db/booking-store";
import {PostgresHostRepository} from "../src/server/db/host-repository";
import {FakeCalendar,FakeClock,MONDAY_8AM,UTC_POLICY,visitor} from "./fakes";

// Real-database tests: `TEST_DATABASE_URL=postgres://... npm run test:db`. Destroys and recreates the `public` schema.
const url=process.env.TEST_DATABASE_URL;
const TEN="2026-10-19T10:00:00.000Z",TEN30="2026-10-19T10:30:00.000Z",ELEVEN="2026-10-19T11:00:00.000Z";

describe.skipIf(!url)("Postgres store (real database)",()=>{
 let pool:Pool,store:PostgresBookingStore,hosts:PostgresHostRepository,hostId:string;
 const key=randomBytes(32);const now=new Date(MONDAY_8AM);const later=(min:number)=>new Date(MONDAY_8AM+min*60_000);
 const hold=(start:string,end:string,at=now,ttlMin=10)=>store.createHold({id:randomUUID(),hostId,provider:"google",start,end,expiresAt:new Date(at.getTime()+ttlMin*60_000),now:at});

 beforeAll(async()=>{
  pool=createPool(url!);
  await pool.query("drop schema if exists public cascade; create schema public;");
  for(const f of readdirSync("supabase/migrations").sort())await pool.query(readFileSync(`supabase/migrations/${f}`,"utf8"));
  store=new PostgresBookingStore(pool);hosts=new PostgresHostRepository(pool,key);
 });
 afterAll(async()=>{await pool?.end()});
 beforeEach(async()=>{
  await pool.query("truncate bookings, integration_accounts, hosts cascade");
  hostId=(await hosts.upsertGoogleHost({sub:"google-sub-1",email:"rajat@example.com",name:"Rajat"})).hostId;
  await hosts.setTimezone(hostId,"UTC");
  await hosts.updateSettings(hostId,UTC_POLICY,null);
  await hosts.saveGoogleConnection(hostId,{externalAccountId:"google-sub-1",email:"rajat@example.com",tokens:{accessToken:"at-secret",refreshToken:"rt-secret",expiresAt:Date.now()+3_600_000,scope:"s"}});
 });

 it("migrations: exclusion constraint present, RLS enabled on every table",async()=>{
  const c=await pool.query("select conname from pg_constraint where conname='bookings_no_overlap'");expect(c.rowCount).toBe(1);
  const r=await pool.query<{relname:string;relrowsecurity:boolean}>("select relname,relrowsecurity from pg_class where relname in ('hosts','integration_accounts','bookings','ai_preferences') order by relname");
  expect(r.rows.every(x=>x.relrowsecurity)).toBe(true);expect(r.rowCount).toBe(4);
 });

 it("20 concurrent holds on the same slot across separate connections: exactly one succeeds",async()=>{
  const results=await Promise.all(Array.from({length:20},()=>hold(TEN,TEN30)));
  expect(results.filter(r=>r.ok)).toHaveLength(1);
  expect(results.filter(r=>!r.ok&&r.reason==="slot_taken")).toHaveLength(19);
 });
 it("partial overlap is rejected; back-to-back slots are allowed ([) ranges)",async()=>{
  expect((await hold(TEN,TEN30)).ok).toBe(true);
  expect((await hold("2026-10-19T10:15:00.000Z","2026-10-19T10:45:00.000Z")).ok).toBe(false);
  expect((await hold(TEN30,ELEVEN)).ok).toBe(true);
 });
 it("an expired hold is swept and the slot can be held again",async()=>{
  const a=await hold(TEN,TEN30);expect(a.ok).toBe(true);
  expect((await hold(TEN,TEN30,later(5))).ok).toBe(false);
  expect((await hold(TEN,TEN30,later(11))).ok).toBe(true);
  if(a.ok)expect((await store.get(a.hold.id))?.status).toBe("expired");
  expect(await store.occupiedIntervals(hostId,{start:TEN,end:ELEVEN},later(11))).toHaveLength(1);
 });
 it("convertHold: expired hold rejected; same idempotency key cannot convert two holds",async()=>{
  const a=await hold(TEN,TEN30),b=await hold(TEN30,ELEVEN),c=await hold("2026-10-19T12:00:00.000Z","2026-10-19T12:30:00.000Z");
  if(!a.ok||!b.ok||!c.ok)throw new Error("setup");
  const conv=(id:string,k:string,at=now)=>store.convertHold({holdId:id,now:at,visitorName:"Ada",visitorEmail:"ada@example.com",visitorTimezone:"UTC",notes:null,title:"t",idempotencyKey:k});
  expect((await conv(a.hold.id,"same-key-0000000001")).ok).toBe(true);
  expect(await conv(b.hold.id,"same-key-0000000001")).toEqual({ok:false,reason:"idempotency_conflict"});
  expect((await store.get(b.hold.id))?.status).toBe("held");// rolled back
  expect(await conv(a.hold.id,"other-key-000000001")).toEqual({ok:false,reason:"hold_not_found"});
  expect(await conv(c.hold.id,"key-c-0000000000001",later(11))).toEqual({ok:false,reason:"hold_expired"});
 });
 it("guarded transitions; failed bookings release the slot",async()=>{
  const a=await hold(TEN,TEN30);if(!a.ok)throw new Error("setup");
  expect(await store.transition(a.hold.id,["confirmed"],{status:"cancelled",now})).toBeNull();
  expect((await store.transition(a.hold.id,["held"],{status:"failed",now,failureReason:"x"}))?.status).toBe("failed");
  expect((await hold(TEN,TEN30)).ok).toBe(true);
 });
 it("moveToHold consumes the hold, moves the booking and releases the old slot atomically",async()=>{
  const a=await hold(TEN,TEN30),b=await hold(ELEVEN,"2026-10-19T11:30:00.000Z");if(!a.ok||!b.ok)throw new Error("setup");
  await store.transition(a.hold.id,["held"],{status:"confirmed",now});
  const m=await store.moveToHold(a.hold.id,b.hold.id,now);
  expect(m.ok&&m.booking.start).toBe(ELEVEN);
  expect((await store.get(b.hold.id))?.status).toBe("consumed");
  expect((await hold(TEN,TEN30)).ok).toBe(true);
 });

 it("end-to-end service on Postgres: 10 visitors race for one slot → one booking, one calendar event",async()=>{
  const clock=new FakeClock(MONDAY_8AM);const calendar=new FakeCalendar();
  const service=new BookingService({store,hosts,calendars:()=>calendar,now:clock.now,newId:randomUUID,manageUrl:id=>`https://app.test/manage/${id}`,holdTtlSeconds:600});
  const slug=(await hosts.getById(hostId))!.host.slug;
  const attempts=await Promise.all(Array.from({length:10},async(_,i)=>{
   const h=await service.createHold(slug,TEN);if(!h.ok)return h;
   return service.confirm({holdId:h.holdId,...visitor(`race-key-${i}-0000000000`)});
  }));
  expect(attempts.filter(a=>a.ok)).toHaveLength(1);
  expect(calendar.confirmedEvents()).toHaveLength(1);
  const rows=await pool.query("select status from bookings where status='confirmed'");expect(rows.rowCount).toBe(1);
 });

 it("credentials are encrypted at rest, scoped to their host, and wiped on disconnect",async()=>{
  const raw=await pool.query<{encrypted_credentials:string;id:string}>("select id,encrypted_credentials from integration_accounts where host_id=$1",[hostId]);
  expect(raw.rows[0].encrypted_credentials).not.toContain("rt-secret");expect(raw.rows[0].encrypted_credentials).not.toContain("at-secret");
  expect((await hosts.load(raw.rows[0].id))?.tokens?.refreshToken).toBe("rt-secret");
  // Ciphertext copied onto another host's account cannot be decrypted (AAD = host id).
  const other=(await hosts.upsertGoogleHost({sub:"google-sub-2",email:"eve@example.com",name:"Eve"})).hostId;
  const otherAcc=await hosts.saveGoogleConnection(other,{externalAccountId:"google-sub-2",email:"eve@example.com",tokens:{accessToken:"e",refreshToken:"e",expiresAt:0,scope:""}});
  await pool.query("update integration_accounts set encrypted_credentials=$1 where id=$2",[raw.rows[0].encrypted_credentials,otherAcc]);
  await expect(hosts.load(otherAcc)).rejects.toThrow();
  // Each host only sees its own connection.
  expect((await hosts.connection(other))?.accountId).toBe(otherAcc);
  expect((await hosts.connection(hostId))?.accountId).toBe(raw.rows[0].id);
  expect(await hosts.disconnect(hostId)).toBe("rt-secret");
  const after=await pool.query("select status,encrypted_credentials from integration_accounts where host_id=$1",[hostId]);
  expect(after.rows[0]).toEqual({status:"revoked",encrypted_credentials:null});
  expect((await hosts.getById(hostId))?.calendar).toBeNull();
 });
 it("slug allocation avoids collisions and reserved words",async()=>{
  const a=await hosts.upsertGoogleHost({sub:"s-a",email:"dashboard@example.com",name:null});
  const b=await hosts.upsertGoogleHost({sub:"s-b",email:"rajat@other.com",name:null});
  const slugs=(await pool.query<{slug:string}>("select slug from hosts where id = any($1)",[[a.hostId,b.hostId]])).rows.map(r=>r.slug);
  expect(slugs).not.toContain("dashboard");expect(slugs).not.toContain("rajat");
  expect((await hosts.upsertGoogleHost({sub:"s-a",email:"dashboard@example.com",name:null}))).toEqual({hostId:a.hostId,created:false});
 });
});
