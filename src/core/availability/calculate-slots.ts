import type {TimeInterval} from "../domain/types";
export type SlotPolicy={durationMinutes:number;stepMinutes:number;bufferBeforeMinutes:number;bufferAfterMinutes:number};
const ms=(minutes:number)=>minutes*60_000;
const overlaps=(aStart:number,aEnd:number,bStart:number,bEnd:number)=>aStart<bEnd&&aEnd>bStart;
export function calculateSlots(window:TimeInterval,busy:TimeInterval[],policy:SlotPolicy):TimeInterval[]{
 const startMs=Date.parse(window.start),endMs=Date.parse(window.end); if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs)return[]; if(policy.durationMinutes<=0||policy.stepMinutes<=0)return[];
 const result:TimeInterval[]=[]; const duration=ms(policy.durationMinutes),step=ms(policy.stepMinutes),before=ms(policy.bufferBeforeMinutes),after=ms(policy.bufferAfterMinutes);
 for(let candidate=startMs;candidate+duration<=endMs;candidate+=step){const candidateEnd=candidate+duration;const blocked=busy.some(item=>overlaps(candidate,candidateEnd,Date.parse(item.start)-before,Date.parse(item.end)+after));if(!blocked)result.push({start:new Date(candidate).toISOString(),end:new Date(candidateEnd).toISOString()});}
 return result;
}
