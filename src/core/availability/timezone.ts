// IANA timezone helpers built on Intl only. UTC is canonical; zones are applied at policy/display boundaries.
export type LocalDateTime={year:number;month:number;day:number;hour:number;minute:number};
export type LocalDate={year:number;month:number;day:number};

const formatters=new Map<string,Intl.DateTimeFormat>();
function formatter(timeZone:string){let f=formatters.get(timeZone);if(!f){f=new Intl.DateTimeFormat("en-US",{timeZone,hourCycle:"h23",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"});formatters.set(timeZone,f)}return f}

export function isValidTimeZone(timeZone:string):boolean{if(!timeZone||timeZone.length>64)return false;try{formatter(timeZone);return true}catch{return false}}

/** Wall-clock fields of `utcMs` in `timeZone`. */
export function utcToLocal(utcMs:number,timeZone:string):LocalDateTime&{second:number}{
 const parts=Object.fromEntries(formatter(timeZone).formatToParts(new Date(utcMs)).filter(p=>p.type!=="literal").map(p=>[p.type,Number(p.value)]));
 return{year:parts.year,month:parts.month,day:parts.day,hour:parts.hour%24,minute:parts.minute,second:parts.second};
}

/** Offset (local − UTC) in ms at the instant `utcMs`. */
export function offsetMs(utcMs:number,timeZone:string):number{const l=utcToLocal(utcMs,timeZone);return Date.UTC(l.year,l.month-1,l.day,l.hour,l.minute,l.second)-Math.floor(utcMs/1000)*1000}

/**
 * Local wall-clock time → UTC ms.
 * DST gap (time does not exist, e.g. 02:30 on spring-forward day): shifts forward by the gap.
 * DST overlap (time occurs twice): resolves to the later (standard-time) instant.
 */
export function localToUtc(local:LocalDateTime,timeZone:string):number{
 const guess=Date.UTC(local.year,local.month-1,local.day,local.hour,local.minute);
 const o1=offsetMs(guess,timeZone);const t1=guess-o1;const o2=offsetMs(t1,timeZone);if(o1===o2)return t1;
 const t2=guess-o2;const o3=offsetMs(t2,timeZone);if(o2===o3)return t2;
 return Math.max(t1,t2);
}

export function localDateOf(utcMs:number,timeZone:string):LocalDate{const l=utcToLocal(utcMs,timeZone);return{year:l.year,month:l.month,day:l.day}}
export function addDays(date:LocalDate,days:number):LocalDate{const d=new Date(Date.UTC(date.year,date.month-1,date.day+days));return{year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()}}
/** ISO weekday (Mon=1 … Sun=7) of a calendar date; independent of zone. */
export function isoWeekday(date:LocalDate):number{const w=new Date(Date.UTC(date.year,date.month-1,date.day)).getUTCDay();return w===0?7:w}
export function compareDates(a:LocalDate,b:LocalDate):number{return Date.UTC(a.year,a.month-1,a.day)-Date.UTC(b.year,b.month-1,b.day)}
