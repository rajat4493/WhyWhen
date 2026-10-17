import {describe,expect,it} from "vitest";
import {availabilityWindows,generateSlots,isOfferedSlot,subtractInterval,validatePolicy} from "../src/core/availability/policy";
import type {AvailabilityPolicy} from "../src/core/domain/types";
import {MONDAY_8AM,UTC_POLICY} from "./fakes";

const now=new Date(MONDAY_8AM);
const monday={start:"2026-10-19T00:00:00.000Z",end:"2026-10-20T00:00:00.000Z"};
const starts=(p:AvailabilityPolicy,busy=[] as {start:string;end:string}[],range=monday,at=now)=>generateSlots({policy:p,now:at,range,busy}).map(s=>s.start.slice(11,16));

describe("policy slot generation",()=>{
 it("applies weekly hours in the host timezone",()=>{
  const p={...UTC_POLICY,timezone:"Asia/Kolkata",minimumNoticeMinutes:0};
  const w=availabilityWindows(p,{startMs:Date.parse("2026-10-20T00:00:00Z"),endMs:Date.parse("2026-10-20T23:59:00Z")});
  expect(w).toContainEqual({start:"2026-10-20T03:30:00.000Z",end:"2026-10-20T11:30:00.000Z"});
 });
 it("keeps local 09:00 across a DST boundary (UTC start moves by an hour)",()=>{
  const p={...UTC_POLICY,timezone:"Europe/Warsaw",minimumNoticeMinutes:0};
  const slots=generateSlots({policy:p,now:new Date("2026-03-26T00:00:00Z"),range:{start:"2026-03-26T00:00:00Z",end:"2026-04-01T00:00:00Z"},busy:[]});
  const firstOf=(day:string)=>slots.find(s=>s.start.startsWith(day))?.start;
  expect(firstOf("2026-03-27")).toBe("2026-03-27T08:00:00.000Z");// Fri, CET
  expect(firstOf("2026-03-30")).toBe("2026-03-30T07:00:00.000Z");// Mon, CEST
  expect(slots.filter(s=>s.start.startsWith("2026-03-30"))).toHaveLength(16);
 });
 it("handles windows that span the DST gap and overlap",()=>{
  const night:AvailabilityPolicy={...UTC_POLICY,timezone:"Europe/Warsaw",weekly:[{weekday:7,start:"01:00",end:"04:00"}],minimumNoticeMinutes:0,horizonDays:365};
  const w=(day:string)=>availabilityWindows(night,{startMs:Date.parse(`${day}T00:00:00Z`)-86_400_000,endMs:Date.parse(`${day}T12:00:00Z`)}).find(x=>x.end.startsWith(day));
  expect(w("2026-03-29")).toEqual({start:"2026-03-29T00:00:00.000Z",end:"2026-03-29T02:00:00.000Z"});// 2h of wall time exists
  expect(w("2026-10-25")).toEqual({start:"2026-10-24T23:00:00.000Z",end:"2026-10-25T03:00:00.000Z"});// 4h
 });
 it("excludes busy calendar events",()=>{
  const s=starts(UTC_POLICY,[{start:"2026-10-19T10:00:00Z",end:"2026-10-19T11:00:00Z"}]);
  expect(s).not.toContain("10:00");expect(s).not.toContain("10:30");expect(s).toContain("11:00");expect(s).toContain("09:30");
 });
 it("applies before/after buffers around busy time",()=>{
  const s=starts({...UTC_POLICY,bufferBeforeMinutes:15,bufferAfterMinutes:15},[{start:"2026-10-19T10:00:00Z",end:"2026-10-19T10:30:00Z"}]);
  expect(s).not.toContain("09:30");expect(s).not.toContain("10:30");expect(s).toContain("09:00");expect(s).toContain("11:00");
 });
 it("enforces minimum notice and keeps slots aligned to the window",()=>{
  expect(starts({...UTC_POLICY,minimumNoticeMinutes:60})[0]).toBe("09:00");
  expect(starts({...UTC_POLICY,minimumNoticeMinutes:70})[0]).toBe("09:30");
  expect(starts({...UTC_POLICY,minimumNoticeMinutes:24*60})).toEqual([]);
 });
 it("enforces the booking horizon",()=>{
  const week={start:"2026-10-19T00:00:00Z",end:"2026-10-26T00:00:00Z"};
  const slots=generateSlots({policy:{...UTC_POLICY,horizonDays:1},now,range:week,busy:[]});
  expect(slots.every(s=>Date.parse(s.end)<=MONDAY_8AM+86_400_000)).toBe(true);
  expect(new Set(slots.map(s=>s.start.slice(0,10)))).toEqual(new Set(["2026-10-19"]));
 });
 it("only accepts exactly offered slots",()=>{
  const ok={start:"2026-10-19T10:00:00.000Z",end:"2026-10-19T10:30:00.000Z"};
  expect(isOfferedSlot({policy:UTC_POLICY,now,slot:ok,busy:[]})).toBe(true);
  expect(isOfferedSlot({policy:UTC_POLICY,now,slot:{start:"2026-10-19T10:10:00.000Z",end:"2026-10-19T10:40:00.000Z"},busy:[]})).toBe(false);
  expect(isOfferedSlot({policy:UTC_POLICY,now,slot:{start:"2026-10-19T18:00:00.000Z",end:"2026-10-19T18:30:00.000Z"},busy:[]})).toBe(false);
  expect(isOfferedSlot({policy:UTC_POLICY,now,slot:{start:"2026-10-24T10:00:00.000Z",end:"2026-10-24T10:30:00.000Z"},busy:[]})).toBe(false);// Saturday
 });
 it("subtracts a booking's own interval from merged busy blocks",()=>{
  expect(subtractInterval([{start:"2026-10-19T09:00:00.000Z",end:"2026-10-19T10:30:00.000Z"}],{start:"2026-10-19T10:00:00.000Z",end:"2026-10-19T10:30:00.000Z"})).toEqual([{start:"2026-10-19T09:00:00.000Z",end:"2026-10-19T10:00:00.000Z"}]);
 });
 it("validates policy input",()=>{
  expect(validatePolicy(UTC_POLICY)).toEqual([]);
  expect(validatePolicy({...UTC_POLICY,timezone:"Nope/Zone",weekly:[{weekday:1,start:"17:00",end:"09:00"}],horizonDays:0})).toHaveLength(3);
 });
});
