import {describe,expect,it} from "vitest";import {MockIntentAdapter} from "../src/core/ai/registry";
describe("MockIntentAdapter",()=>{
 it("flags explicit call request",async()=>{expect((await new MockIntentAdapter().decide("Can we have a 30 minute call to review the architecture?",{mode:"mock"})).needsMeeting).toBe(true)});
 it("does not force a meeting for a plain question",async()=>{expect((await new MockIntentAdapter().decide("What is your consulting rate?",{mode:"mock"})).needsMeeting).toBe(false)})
});
