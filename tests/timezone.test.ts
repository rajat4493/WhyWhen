import {describe,expect,it} from "vitest";
import {isValidTimeZone,localToUtc,utcToLocal} from "../src/core/availability/timezone";
const iso=(ms:number)=>new Date(ms).toISOString();
describe("timezone conversion",()=>{
 it("converts host-local wall time to UTC in winter and summer",()=>{
  expect(iso(localToUtc({year:2026,month:1,day:15,hour:9,minute:0},"Europe/Warsaw"))).toBe("2026-01-15T08:00:00.000Z");
  expect(iso(localToUtc({year:2026,month:7,day:15,hour:9,minute:0},"Europe/Warsaw"))).toBe("2026-07-15T07:00:00.000Z");
  expect(iso(localToUtc({year:2026,month:7,day:15,hour:9,minute:0},"Asia/Kolkata"))).toBe("2026-07-15T03:30:00.000Z");
  expect(iso(localToUtc({year:2026,month:7,day:15,hour:9,minute:0},"America/New_York"))).toBe("2026-07-15T13:00:00.000Z");
 });
 it("round-trips UTC → local",()=>{expect(utcToLocal(Date.parse("2026-10-24T23:30:00Z"),"Europe/Warsaw")).toMatchObject({year:2026,month:10,day:25,hour:1,minute:30})});
 it("DST gap: nonexistent 02:30 on spring-forward day shifts forward",()=>{
  // Warsaw 2026-03-29: 02:00 → 03:00. 02:30 does not exist; resolves to 03:30 CEST = 01:30Z.
  expect(iso(localToUtc({year:2026,month:3,day:29,hour:2,minute:30},"Europe/Warsaw"))).toBe("2026-03-29T01:30:00.000Z");
  expect(iso(localToUtc({year:2026,month:3,day:29,hour:3,minute:0},"Europe/Warsaw"))).toBe("2026-03-29T01:00:00.000Z");
 });
 it("DST overlap: ambiguous 02:30 on fall-back day resolves to the later instant",()=>{
  // Warsaw 2026-10-25: 03:00 → 02:00. 02:30 occurs at 00:30Z (CEST) and 01:30Z (CET).
  expect(iso(localToUtc({year:2026,month:10,day:25,hour:2,minute:30},"Europe/Warsaw"))).toBe("2026-10-25T01:30:00.000Z");
 });
 it("validates IANA zones",()=>{expect(isValidTimeZone("Europe/Warsaw")).toBe(true);expect(isValidTimeZone("Mars/Base")).toBe(false);expect(isValidTimeZone("")).toBe(false)});
});
