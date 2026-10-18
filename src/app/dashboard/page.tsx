import type {CalendarSummary} from "@/core/integrations/calendar/adapter";
import {getServices} from "@/server/container";
import {ConfigurationError} from "@/server/env";
import {sessionHostId} from "@/server/http";
import {SLUG_MAX,normalizeSlugInput,slugProblem} from "@/core/hosts/slug";
import {CopyLink} from "@/app/components/copy-link";
import {Avatar,IconCalendar,Wordmark} from "@/app/components/icons";
import {cancelBooking,chooseSlug,retryBooking,saveSettings} from "./actions";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};

const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const NOTICE=[[0,"None"],[30,"30 minutes"],[60,"1 hour"],[120,"2 hours"],[240,"4 hours"],[480,"8 hours"],[1440,"1 day"],[2880,"2 days"]] as const;
const MESSAGES:Record<string,string>={
 "error=state":"Sign-in expired or was tampered with. Please try again.","error=denied":"Google access was not granted.","error=scopes":"Calendar permissions are required. Please allow all requested calendar access.",
 "error=offline":"Google did not provide offline access. Remove this app at myaccount.google.com/permissions and connect again.","error=google":"Google sign-in failed. Please try again.",
 "error=settings":"Some settings were invalid. Nothing was saved.","error=calendar":"That calendar can't be used.","error=cancel":"The booking couldn't be cancelled; the calendar may be unreachable.","error=retry":"The calendar still couldn't confirm. Try again shortly.","error=booking":"Unknown booking.",
 "saved=1":"Saved.","connected=1":"Google Calendar connected.","disconnected=1":"Disconnected. Your booking page is paused.","cancelled=1":"Booking cancelled.","retried=1":"Booking confirmed in the calendar.","linked=1":"Your link is live. Set your availability below.",
};
const STATUS_LABEL:Record<string,string>={confirmed:"Confirmed",needs_reconciliation:"Not confirmed in calendar",pending_event:"Confirming",failed:"Failed — not booked",cancelled:"Cancelled"};

function Shell({children,right}:{children:React.ReactNode;right?:React.ReactNode}){return <main className="page" style={{width:"min(100% - 32px, 640px)"}}><nav className="topbar"><Wordmark/>{right}</nav>{children}</main>}
/** 24h half-hour steps (unambiguous on every locale and narrow phone). Keeps an off-grid saved value selectable. */
const hhmm=(i:number)=>`${String(Math.floor(i/2)).padStart(2,"0")}:${i%2?"30":"00"}`;
function TimeSelect({name,value,label,from,to}:{name:string;value:string;label:string;from:number;to:number}){
 const opts=Array.from({length:to-from+1},(_,k)=>hhmm(from+k));if(!opts.includes(value))opts.push(value);opts.sort();
 return <select className="field" name={name} defaultValue={value} aria-label={label}>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>;
}
const SignOut=()=><form action="/api/host/logout" method="post"><button className="button ghost">Sign out</button></form>;

export default async function DashboardPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const q=await searchParams;const notice=Object.entries(q).map(([k,v])=>MESSAGES[`${k}=${v}`]).find(Boolean);
 let services;try{services=getServices()}catch(err){if(err instanceof ConfigurationError)return <Shell><h1 className="display">Not configured yet.</h1><p className="lede">Set the environment variables listed in <span className="mono">.env.example</span>, then reload.</p><p className="notice warn mono section">{err.message}</p></Shell>;throw err}
 const {env,hosts,google,bookings}=services;
 const hostId=await sessionHostId(env.SESSION_SECRET);
 const ctx=hostId?await hosts.getById(hostId):null;
 if(!ctx)return <Shell>
  <h1 className="display">Your link, <em>ready</em> in a minute.</h1>
  <p className="lede">Connect the Google Calendar your bookings go into. Visitors only ever see when you&apos;re free, never your events.</p>
  {notice&&<p className="notice error section">{notice}</p>}
  <p className="section"><a className="button accent" href="/api/oauth/google/start"><IconCalendar size={18}/>Continue with Google Calendar</a></p>
  <p className="tiny">Connecting also signs you in. You can disconnect at any time.</p>
 </Shell>;

 const {host,calendar}=ctx;
 if(!host.slug){
  // First-time setup: choose the public link. Suggested from the Google display name; chosen once (no V0 editing).
  const attempted=q.slug?normalizeSlugInput(q.slug):null;
  const value=attempted??await hosts.suggestSlug(host.displayName,host.email);
  const error=q.slugError==="taken"?"That link is taken. Please choose another.":q.slugError?slugProblem(attempted??"")??"Please choose another link.":null;
  const prefix=`${env.appUrl.replace(/^https?:\/\//,"")}/`;
  return <Shell right={<SignOut/>}>
   <p className="eyebrow">Welcome, {host.displayName.split(/\s+/)[0]}</p>
   <h1 className="display" style={{marginTop:8}}>Choose your <em>link</em>.</h1>
   <p className="lede">This is what you&apos;ll share. Keep it short and recognisable.</p>
   <form action={chooseSlug} className="card stack section" style={{padding:20}}>
    <label className="label" htmlFor="slug">WhyWhen link</label>
    <div className="slug-field"><span className="prefix">{prefix}</span><input id="slug" className="field" name="slug" defaultValue={value} required minLength={3} maxLength={SLUG_MAX} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="slug-help"/></div>
    <p id="slug-help" className="tiny" style={{margin:0}}>Lowercase letters, numbers and hyphens. This can&apos;t be changed later.</p>
    {error&&<p className="notice error" role="alert" style={{margin:0}}>{error}</p>}
    <button className="button accent block">Continue</button>
   </form></Shell>;
 }
 const publicUrl=`${env.appUrl}/${host.slug}`;
 const calendars:CalendarSummary[]|null=calendar?await google.listCalendars(calendar).then(c=>c.filter(x=>x.writable)).catch(()=>null):null;
 const list=await bookings.listForHost(host.id);
 const timezones=Intl.supportedValuesOf("timeZone");
 const rule=(d:number)=>host.policy.weekly.find(r=>r.weekday===d);
 const tz=host.policy.timezone;
 const part=(iso:string,o:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat("en-GB",{timeZone:tz,...o}).format(new Date(iso));

 return <Shell right={<span style={{display:"flex",alignItems:"center",gap:6}}><SignOut/><Avatar name={host.displayName} size="sm"/></span>}>
  <h1 className="display" style={{fontSize:40}}>Hi, {host.displayName.split(/\s+/)[0]}.</h1>
  <p className="subtle" style={{marginTop:6}}>{host.email}</p>
  {notice&&<p className={`notice ${q.error?"error":"ok"} section`} role="status">{notice}</p>}
  <div className="dash-grid section">
   <section className="panel">
    <div className="panel-head"><h2 className="h3">Your link</h2><span className={`pill${calendar?" live":""}`}>{calendar?"Live":"Paused"}</span></div>
    <div className="link-box"><a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl.replace(/^https?:\/\//,"")}</a><CopyLink url={publicUrl}/></div>
   </section>

   <section className="panel">
    <div className="panel-head"><h2 className="h3">Upcoming</h2><span className="subtle">{list.length?`${list.length} booking${list.length===1?"":"s"}`:""}</span></div>
    {list.length===0?<p className="subtle" style={{margin:0}}>No bookings yet. Share your link to get the first one.</p>:<ul className="list">{list.map(b=><li key={b.id}>
     <span className="when"><span className="datebox"><span>{part(b.start,{month:"short"})}</span><b>{part(b.start,{day:"numeric"})}</b></span>
      <span style={{minWidth:0}}><b style={{display:"block"}}>{b.visitorName}</b><span className="subtle">{part(b.start,{weekday:"short",hour:"2-digit",minute:"2-digit"})} · {b.visitorEmail}</span></span></span>
     <span style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}><span className={`pill${b.status==="confirmed"?" live":""}`}>{STATUS_LABEL[b.status]??b.status}</span>
      {(b.status==="needs_reconciliation"||b.status==="pending_event")&&<form action={retryBooking} className="inline"><input type="hidden" name="bookingId" value={b.id}/><button className="button" style={{minHeight:34}}>Retry</button></form>}
      {(b.status==="confirmed"||b.status==="needs_reconciliation")&&<form action={cancelBooking} className="inline"><input type="hidden" name="bookingId" value={b.id}/><button className="button ghost" style={{minHeight:34}}>Cancel</button></form>}
     </span>
    </li>)}</ul>}
   </section>

   <form action={saveSettings} className="panel stack-lg">
    <div className="stack">
     <h2 className="h3">Meeting</h2>
     <div className="segmented" role="radiogroup" aria-label="Meeting length">{[15,30,45,60].map(m=><label key={m}><input type="radio" name="durationMinutes" value={m} defaultChecked={host.policy.durationMinutes===m} aria-label={`${m} minutes`}/><span>{m} min</span></label>)}</div>
    </div>
    <div className="stack">
     <h2 className="h3">Weekly hours</h2>
     <label className="label">Timezone<select className="field" name="timezone" defaultValue={tz}>{timezones.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
     <div className="week" role="group" aria-label="Weekly hours">{DAYS.map((name,i)=>{const r=rule(i+1);return <div className="week-row" key={name}>
      <label className="check"><input type="checkbox" name={`day${i+1}_on`} defaultChecked={Boolean(r)}/>{name}</label>
      <TimeSelect name={`day${i+1}_start`} value={r?.start??"09:00"} label={`${name} start`} from={0} to={47}/>
      <span className="sep">–</span>
      <TimeSelect name={`day${i+1}_end`} value={r?.end??"17:00"} label={`${name} end`} from={1} to={48}/>
     </div>})}</div>
    </div>
    <div className="stack">
     <h2 className="h3">Rules</h2>
     <div className="two">
      <label className="label">Minimum notice<select className="field" name="minimumNoticeMinutes" defaultValue={host.policy.minimumNoticeMinutes}>{NOTICE.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="label">Bookable up to (days ahead)<input className="field" type="number" min={1} max={365} name="horizonDays" defaultValue={host.policy.horizonDays}/></label>
      <label className="label">Buffer before (minutes)<input className="field" type="number" min={0} max={240} step={5} name="bufferBeforeMinutes" defaultValue={host.policy.bufferBeforeMinutes}/></label>
      <label className="label">Buffer after (minutes)<input className="field" type="number" min={0} max={240} step={5} name="bufferAfterMinutes" defaultValue={host.policy.bufferAfterMinutes}/></label>
     </div>
    </div>
    {calendars&&<label className="label">Calendar for bookings and busy times<select className="field" name="calendarId" defaultValue={calendar?.calendarId}>{calendars.map(c=><option key={c.id} value={c.id}>{c.name}{c.primary?" (primary)":""}</option>)}</select></label>}
    <div><button className="button accent">Save changes</button></div>
   </form>

   <section className="panel">
    <div className="panel-head"><h2 className="h3">Google Calendar</h2><span className={`pill${calendar?" live":""}`}>{calendar?"Connected":"Not connected"}</span></div>
    {calendar&&!calendars&&<p className="notice warn">Couldn&apos;t load your calendar list from Google. Bookings use “{calendar.calendarId}”.</p>}
    {calendar?<form action="/api/host/disconnect" method="post"><button className="button">Disconnect</button></form>:<a className="button accent" href="/api/oauth/google/start">Reconnect Google Calendar</a>}
   </section>
  </div>
 </Shell>;
}
