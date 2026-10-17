import type {AvailabilityPolicy,TimeInterval,WeeklyRule} from "../domain/types";
import {calculateSlots} from "./calculate-slots";
import {addDays,compareDates,isoWeekday,isValidTimeZone,localDateOf,localToUtc} from "./timezone";

const MINUTE=60_000,DAY=86_400_000;
const HHMM=/^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;

function parseHHMM(value:string){const [h,m]=value.split(":").map(Number);return{hour:h,minute:m}}
export function minutesOfDay(value:string){const {hour,minute}=parseHHMM(value);return hour*60+minute}

/** Returns human-readable problems; empty array means valid. */
export function validatePolicy(policy:AvailabilityPolicy):string[]{
 const errors:string[]=[];
 if(!isValidTimeZone(policy.timezone))errors.push("Unknown timezone");
 if(![15,30,45,60].includes(policy.durationMinutes))errors.push("Duration must be 15, 30, 45 or 60 minutes");
 for(const [name,v,max] of [["Buffer before",policy.bufferBeforeMinutes,240],["Buffer after",policy.bufferAfterMinutes,240],["Minimum notice",policy.minimumNoticeMinutes,43_200]] as const)if(!Number.isInteger(v)||v<0||v>max)errors.push(`${name} must be between 0 and ${max} minutes`);
 if(!Number.isInteger(policy.horizonDays)||policy.horizonDays<1||policy.horizonDays>365)errors.push("Booking horizon must be between 1 and 365 days");
 for(const rule of policy.weekly){if(!Number.isInteger(rule.weekday)||rule.weekday<1||rule.weekday>7)errors.push("Invalid weekday");else if(!HHMM.test(rule.start)||!HHMM.test(rule.end)||minutesOfDay(rule.end)<=minutesOfDay(rule.start))errors.push(`Invalid hours for weekday ${rule.weekday}`)}
 return errors;
}

/** Host weekly rules expanded into UTC windows that touch `range`. */
export function availabilityWindows(policy:Pick<AvailabilityPolicy,"timezone"|"weekly">,range:{startMs:number;endMs:number}):TimeInterval[]{
 const windows:TimeInterval[]=[];
 const last=localDateOf(range.endMs,policy.timezone);
 for(let date=addDays(localDateOf(range.startMs,policy.timezone),-1);compareDates(date,last)<=0;date=addDays(date,1)){
  const weekday=isoWeekday(date);
  for(const rule of policy.weekly.filter((r:WeeklyRule)=>r.weekday===weekday)){
   const s=parseHHMM(rule.start),e=parseHHMM(rule.end);
   const startMs=localToUtc({...date,...s},policy.timezone),endMs=localToUtc({...date,...e},policy.timezone);
   if(endMs>startMs&&endMs>range.startMs&&startMs<range.endMs)windows.push({start:new Date(startMs).toISOString(),end:new Date(endMs).toISOString()});
  }
 }
 return windows;
}

export function stepMinutesFor(policy:Pick<AvailabilityPolicy,"durationMinutes">){return Math.min(policy.durationMinutes,30)}

/**
 * Bookable slots inside `range`: weekly rules (host timezone) minus busy time (with buffers),
 * no earlier than `now + minimum notice`, no later than `now + horizon`.
 * Slots are aligned to the start of each availability window, not to `now`.
 */
export function generateSlots(input:{policy:AvailabilityPolicy;now:Date;range:TimeInterval;busy:TimeInterval[]}):TimeInterval[]{
 const {policy}=input;const nowMs=input.now.getTime();
 const earliest=Math.max(Date.parse(input.range.start),nowMs+policy.minimumNoticeMinutes*MINUTE);
 const latest=Math.min(Date.parse(input.range.end),nowMs+policy.horizonDays*DAY);
 if(!Number.isFinite(earliest)||!Number.isFinite(latest)||latest<=earliest)return[];
 const slotPolicy={durationMinutes:policy.durationMinutes,stepMinutes:stepMinutesFor(policy),bufferBeforeMinutes:policy.bufferBeforeMinutes,bufferAfterMinutes:policy.bufferAfterMinutes};
 return availabilityWindows(policy,{startMs:earliest,endMs:latest})
  .flatMap(window=>calculateSlots(window,input.busy,slotPolicy))
  .filter(slot=>Date.parse(slot.start)>=earliest&&Date.parse(slot.end)<=latest);
}

/** True when `slot` is exactly one of the slots the policy would offer right now. */
export function isOfferedSlot(input:{policy:AvailabilityPolicy;now:Date;slot:TimeInterval;busy:TimeInterval[]}):boolean{
 const start=Date.parse(input.slot.start),end=Date.parse(input.slot.end);
 if(!Number.isFinite(start)||end-start!==input.policy.durationMinutes*MINUTE)return false;
 return generateSlots({policy:input.policy,now:input.now,range:input.slot,busy:input.busy}).some(s=>Date.parse(s.start)===start);
}

/** Interval expanded by the policy buffers: the time that must be free on the calendar. */
export function bufferedInterval(slot:TimeInterval,policy:Pick<AvailabilityPolicy,"bufferBeforeMinutes"|"bufferAfterMinutes">):TimeInterval{
 return{start:new Date(Date.parse(slot.start)-policy.bufferBeforeMinutes*MINUTE).toISOString(),end:new Date(Date.parse(slot.end)+policy.bufferAfterMinutes*MINUTE).toISOString()};
}

export function overlapsAny(slot:TimeInterval,busy:TimeInterval[]):boolean{const s=Date.parse(slot.start),e=Date.parse(slot.end);return busy.some(b=>s<Date.parse(b.end)&&e>Date.parse(b.start))}

/** `busy` with `remove` cut out (free/busy merges adjacent blocks, so a booking's own block may be part of a larger one). */
export function subtractInterval(busy:TimeInterval[],remove:TimeInterval):TimeInterval[]{
 const rs=Date.parse(remove.start),re=Date.parse(remove.end);
 return busy.flatMap(b=>{const bs=Date.parse(b.start),be=Date.parse(b.end);if(be<=rs||bs>=re)return[b];const out:TimeInterval[]=[];if(bs<rs)out.push({start:b.start,end:remove.start});if(be>re)out.push({start:remove.end,end:b.end});return out});
}
