"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {validatePolicy} from "@/core/availability/policy";
import type {AvailabilityPolicy,MeetingDuration,WeeklyRule,Weekday} from "@/core/domain/types";
import {getServices} from "@/server/container";
import {sessionHostId} from "@/server/http";
import {timezoneSchema,uuidSchema} from "@/server/validation";

// Every action derives the host from the signed session cookie; client-supplied ids are only ever matched against it.
async function requireHost(){const {env}=getServices();const hostId=await sessionHostId(env.SESSION_SECRET);if(!hostId)redirect("/dashboard");return hostId}
const done=(query:string):never=>{revalidatePath("/dashboard");redirect(`/dashboard?${query}`)};

const minutes=(max:number)=>z.coerce.number().int().min(0).max(max);
const settingsSchema=z.object({
 calendarId:z.string().min(1).max(320).optional(),
 timezone:timezoneSchema,
 durationMinutes:z.coerce.number().refine(v=>[15,30,45,60].includes(v)),
 bufferBeforeMinutes:minutes(240),bufferAfterMinutes:minutes(240),minimumNoticeMinutes:minutes(43_200),
 horizonDays:z.coerce.number().int().min(1).max(365),
});

export async function saveSettings(form:FormData){
 const hostId=await requireHost();
 const parsed=settingsSchema.safeParse(Object.fromEntries(["calendarId","timezone","durationMinutes","bufferBeforeMinutes","bufferAfterMinutes","minimumNoticeMinutes","horizonDays"].map(k=>[k,form.get(k)??undefined])));
 if(!parsed.success)return done("error=settings");
 const weekly:WeeklyRule[]=[];
 for(let d=1;d<=7;d++)if(form.get(`day${d}_on`)){
  // <input type="time"> cannot show 24:00; an end of 00:00 means "until midnight".
  const end=String(form.get(`day${d}_end`)??"");
  weekly.push({weekday:d as Weekday,start:String(form.get(`day${d}_start`)??""),end:end==="00:00"?"24:00":end});
 }
 const p=parsed.data;
 const policy:AvailabilityPolicy={timezone:p.timezone,weekly,durationMinutes:p.durationMinutes as MeetingDuration,bufferBeforeMinutes:p.bufferBeforeMinutes,bufferAfterMinutes:p.bufferAfterMinutes,minimumNoticeMinutes:p.minimumNoticeMinutes,horizonDays:p.horizonDays};
 if(validatePolicy(policy).length)return done("error=settings");
 const {hosts,google}=getServices();
 let calendarId:string|null=null;
 const ctx=await hosts.getById(hostId);
 if(p.calendarId&&ctx?.calendar&&p.calendarId!==ctx.calendar.calendarId){
  // Only calendars this host owns, as reported by Google, can be selected.
  const calendars=await google.listCalendars(ctx.calendar).catch(()=>null);
  if(!calendars?.some(c=>c.id===p.calendarId&&c.writable))return done("error=calendar");
  calendarId=p.calendarId;
 }
 await hosts.updateSettings(hostId,policy,calendarId);
 return done("saved=1");
}

export async function cancelBooking(form:FormData){
 const hostId=await requireHost();const id=uuidSchema.safeParse(form.get("bookingId"));if(!id.success)return done("error=booking");
 const r=await getServices().bookings.cancel(id.data,{hostId});
 return done(r.ok?"cancelled=1":"error=cancel");
}

export async function retryBooking(form:FormData){
 const hostId=await requireHost();const id=uuidSchema.safeParse(form.get("bookingId"));if(!id.success)return done("error=booking");
 const r=await getServices().bookings.reconcile(id.data,hostId);
 return done(r.ok&&r.outcome==="confirmed"?"retried=1":"error=retry");
}
