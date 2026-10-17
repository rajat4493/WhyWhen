import type {CalendarSummary} from "@/core/integrations/calendar/adapter";
import {getServices} from "@/server/container";
import {ConfigurationError} from "@/server/env";
import {sessionHostId} from "@/server/http";
import {cancelBooking,retryBooking,saveSettings} from "./actions";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};

const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const NOTICE=[[0,"None"],[30,"30 minutes"],[60,"1 hour"],[120,"2 hours"],[240,"4 hours"],[480,"8 hours"],[1440,"1 day"],[2880,"2 days"]] as const;
const MESSAGES:Record<string,string>={
 "error=state":"Sign-in expired or was tampered with. Please try again.","error=denied":"Google access was not granted.","error=scopes":"Calendar permissions are required. Please allow all requested calendar access.",
 "error=offline":"Google did not provide offline access. Remove this app at myaccount.google.com/permissions and connect again.","error=google":"Google sign-in failed. Please try again.",
 "error=settings":"Some settings were invalid. Nothing was saved.","error=calendar":"That calendar can't be used.","error=cancel":"The booking couldn't be cancelled; the calendar may be unreachable.","error=retry":"The calendar still couldn't confirm. Try again shortly.","error=booking":"Unknown booking.",
 "saved=1":"Saved.","connected=1":"Google Calendar connected.","disconnected=1":"Disconnected. Your booking page is paused.","cancelled=1":"Booking cancelled.","retried=1":"Booking confirmed in the calendar.",
};
const STATUS_LABEL:Record<string,string>={confirmed:"Confirmed",needs_reconciliation:"Not confirmed in calendar",pending_event:"Confirming",failed:"Failed — not booked",cancelled:"Cancelled"};

function Shell({children}:{children:React.ReactNode}){return <main className="shell"><div className="brand"><span className="brand-mark"/>Host settings</div>{children}</main>}

export default async function DashboardPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const q=await searchParams;const notice=Object.entries(q).map(([k,v])=>MESSAGES[`${k}=${v}`]).find(Boolean);
 let services;try{services=getServices()}catch(err){if(err instanceof ConfigurationError)return <Shell><h1>Not configured yet.</h1><p className="lede">Set the environment variables listed in <span className="mono">.env.example</span>, then reload.</p><p className="notice warn mono">{err.message}</p></Shell>;throw err}
 const {env,hosts,google,bookings}=services;
 const hostId=await sessionHostId(env.SESSION_SECRET);
 const ctx=hostId?await hosts.getById(hostId):null;
 if(!ctx)return <Shell><h1>Connect your calendar.</h1><p className="lede">Sign in with Google to connect the calendar your bookings go into. Visitors only ever see free times, never your events.</p>
  {notice&&<p className="notice error section">{notice}</p>}
  <p className="section"><a className="button primary" href="/api/oauth/google/start">Connect Google Calendar</a></p></Shell>;

 const {host,calendar}=ctx;const publicUrl=`${env.appUrl}/${host.slug}`;
 const calendars:CalendarSummary[]|null=calendar?await google.listCalendars(calendar).then(c=>c.filter(x=>x.writable)).catch(()=>null):null;
 const list=await bookings.listForHost(host.id);
 const timezones=Intl.supportedValuesOf("timeZone");
 const rule=(d:number)=>host.policy.weekly.find(r=>r.weekday===d);
 const fmt=(iso:string)=>new Intl.DateTimeFormat("en-GB",{timeZone:host.policy.timezone,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));

 return <Shell>
  <p className="eyebrow">Signed in as {host.email}</p><h1>Your booking page.</h1>
  {notice&&<p className={`notice ${q.error?"error":""} section`}>{notice}</p>}
  <section className="section stack">
   <div className="panel stack"><div className="row"><strong>Public link</strong><span className="pill">{calendar?"Live":"Paused"}</span></div><a className="mono" href={publicUrl}>{publicUrl}</a></div>

   <div className="panel stack"><div className="row"><strong>Calendar</strong><span className="pill">{calendar?"Google · connected":"Not connected"}</span></div>
    {calendar?<form action="/api/host/disconnect" method="post"><button className="button">Disconnect Google</button></form>:<a className="button primary" href="/api/oauth/google/start">Reconnect Google Calendar</a>}
    {calendar&&!calendars&&<p className="notice warn">Couldn&apos;t load your calendar list from Google. Bookings use “{calendar.calendarId}”.</p>}
   </div>

   <form action={saveSettings} className="panel stack">
    <strong>Availability</strong>
    {calendars&&<label className="label">Calendar for bookings and busy times<select className="field" name="calendarId" defaultValue={calendar?.calendarId}>{calendars.map(c=><option key={c.id} value={c.id}>{c.name}{c.primary?" (primary)":""}</option>)}</select></label>}
    <label className="label">Timezone<select className="field" name="timezone" defaultValue={host.policy.timezone}>{timezones.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
    <div className="week" role="group" aria-label="Weekly hours">{DAYS.map((name,i)=>{const r=rule(i+1);return <div className="week-row" key={name}>
     <label><input type="checkbox" name={`day${i+1}_on`} defaultChecked={Boolean(r)}/>{name}</label>
     <input className="field" type="time" name={`day${i+1}_start`} defaultValue={r?.start??"09:00"} aria-label={`${name} start`}/>
     <input className="field" type="time" name={`day${i+1}_end`} defaultValue={r?.end==="24:00"?"00:00":r?.end??"17:00"} aria-label={`${name} end`}/>
    </div>})}</div>
    <div className="two">
     <label className="label">Meeting length<select className="field" name="durationMinutes" defaultValue={host.policy.durationMinutes}>{[15,30,45,60].map(m=><option key={m} value={m}>{m} minutes</option>)}</select></label>
     <label className="label">Minimum notice<select className="field" name="minimumNoticeMinutes" defaultValue={host.policy.minimumNoticeMinutes}>{NOTICE.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     <label className="label">Buffer before (minutes)<input className="field" type="number" min={0} max={240} step={5} name="bufferBeforeMinutes" defaultValue={host.policy.bufferBeforeMinutes}/></label>
     <label className="label">Buffer after (minutes)<input className="field" type="number" min={0} max={240} step={5} name="bufferAfterMinutes" defaultValue={host.policy.bufferAfterMinutes}/></label>
     <label className="label">Bookable up to (days ahead)<input className="field" type="number" min={1} max={365} name="horizonDays" defaultValue={host.policy.horizonDays}/></label>
    </div>
    <div><button className="button primary">Save</button></div>
   </form>

   <div className="panel stack"><strong>Upcoming bookings</strong>
    {list.length===0?<p className="subtle">No bookings yet.</p>:<ul className="list">{list.map(b=><li key={b.id}>
     <span>{fmt(b.start)} · {b.visitorName} <span className="subtle">{b.visitorEmail}</span></span>
     <span style={{display:"flex",gap:8,alignItems:"center"}}><span className="pill">{STATUS_LABEL[b.status]??b.status}</span>
      {(b.status==="needs_reconciliation"||b.status==="pending_event")&&<form action={retryBooking} className="inline"><input type="hidden" name="bookingId" value={b.id}/><button className="button">Retry</button></form>}
      {(b.status==="confirmed"||b.status==="needs_reconciliation")&&<form action={cancelBooking} className="inline"><input type="hidden" name="bookingId" value={b.id}/><button className="button">Cancel</button></form>}
     </span>
    </li>)}</ul>}
   </div>
   <form action="/api/host/logout" method="post"><button className="button">Sign out</button></form>
  </section>
 </Shell>;
}
