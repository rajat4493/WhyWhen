import {describe,expect,it} from "vitest";import {calculateSlots} from "../src/core/availability/calculate-slots";
const window={start:"2026-10-20T09:00:00.000Z",end:"2026-10-20T12:00:00.000Z"};
describe("calculateSlots",()=>{
 it("returns contiguous slots when nothing is busy",()=>{const slots=calculateSlots(window,[],{durationMinutes:30,stepMinutes:30,bufferBeforeMinutes:0,bufferAfterMinutes:0});expect(slots).toHaveLength(6);expect(slots[0].start).toBe("2026-10-20T09:00:00.000Z")});
 it("removes overlap",()=>{const slots=calculateSlots(window,[{start:"2026-10-20T10:00:00.000Z",end:"2026-10-20T10:30:00.000Z"}],{durationMinutes:30,stepMinutes:30,bufferBeforeMinutes:0,bufferAfterMinutes:0});expect(slots.some(s=>s.start==="2026-10-20T10:00:00.000Z")).toBe(false);expect(slots).toHaveLength(5)});
 it("honors buffers",()=>{const slots=calculateSlots(window,[{start:"2026-10-20T10:00:00.000Z",end:"2026-10-20T10:30:00.000Z"}],{durationMinutes:30,stepMinutes:30,bufferBeforeMinutes:15,bufferAfterMinutes:15});expect(slots.some(s=>s.start==="2026-10-20T09:30:00.000Z")).toBe(false);expect(slots.some(s=>s.start==="2026-10-20T10:30:00.000Z")).toBe(false)});
 it("returns no slots for invalid window",()=>{expect(calculateSlots({start:window.end,end:window.start},[],{durationMinutes:30,stepMinutes:30,bufferBeforeMinutes:0,bufferAfterMinutes:0})).toEqual([])});
 it("supports 15m stepping",()=>{const slots=calculateSlots({start:"2026-10-20T09:00:00.000Z",end:"2026-10-20T10:00:00.000Z"},[],{durationMinutes:30,stepMinutes:15,bufferBeforeMinutes:0,bufferAfterMinutes:0});expect(slots.map(s=>s.start)).toEqual(["2026-10-20T09:00:00.000Z","2026-10-20T09:15:00.000Z","2026-10-20T09:30:00.000Z"])})
});
