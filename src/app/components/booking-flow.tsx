"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {NEED_MAX,needKey} from "./composer";
import {IconArrowLeft,IconCalendar,IconCheck,IconChevronLeft,IconChevronRight,IconClock,IconGlobe} from "./icons";

type Slot={start:string;end:string};
type Mode={kind:"book"}|{kind:"reschedule";token:string};
type ApiError={code?:string;message?:string;retryable?:boolean};
type Done={start:string;end:string;email:string|null;manageUrl:string};
type Step={name:"pick"}|{name:"details";holdId:string;slot:Slot}|{name:"done";result:Done}|{name:"pending";holdId:string;slot:Slot};
type Month={y:number;m:number};// m: 1–12

const DAY=86_400_000;
const visitorTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}catch{return"UTC"}};
const dayKey=(iso:string|number,tz:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));
const keyOf=(y:number,m:number,d:number)=>`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
const fmtTime=(iso:string,tz:string)=>new Intl.DateTimeFormat(undefined,{timeZone:tz,hour:"numeric",minute:"2-digit"}).format(new Date(iso));
export const fmtFull=(iso:string,tz:string)=>new Intl.DateTimeFormat(undefined,{timeZone:tz,weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(iso));
const fmtDayLong=(key:string)=>new Intl.DateTimeFormat(undefined,{timeZone:"UTC",weekday:"long",month:"long",day:"numeric"}).format(new Date(`${key}T12:00:00Z`));
const newKey=()=>crypto.randomUUID().replace(/-/g,"");
/** 1 = Monday … 7 = Sunday, from the visitor's locale when the browser exposes it. */
function firstDayOfWeek(){try{const l=new Intl.Locale(navigator.language) as Intl.Locale&{getWeekInfo?:()=>{firstDay:number};weekInfo?:{firstDay:number}};return(l.getWeekInfo?.()??l.weekInfo)?.firstDay??1}catch{return 1}}

async function post(url:string,body?:unknown){
 const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json().catch(()=>({})) as Record<string,unknown>&ApiError;
 return{status:r.status,data};
}

export function BookingFlow({slug,hostName,durationMinutes,horizonDays=60,mode={kind:"book"},onRescheduled}:{slug:string;hostName:string;durationMinutes:number;horizonDays?:number;mode?:Mode;onRescheduled?:(slot:Slot)=>void}){
 const [tz,setTz]=useState<string|null>(null);
 const [weekStart,setWeekStart]=useState(1);
 const [month,setMonth]=useState<Month|null>(null);
 const [slotsByMonth,setSlotsByMonth]=useState<Record<string,Slot[]>>({});
 const [loading,setLoading]=useState(true);
 const [day,setDay]=useState<string|null>(null);
 const [step,setStep]=useState<Step>({name:"pick"});
 const [message,setMessage]=useState<{tone:"warn"|"error";text:string}|null>(null);
 const [busy,setBusy]=useState(false);
 const [form,setForm]=useState({name:"",email:"",notes:""});
 const [need,setNeed]=useState("");
 const key=useRef("");
 const autoAdvanced=useRef(false);

 useEffect(()=>{if(mode.kind!=="book")return;try{const n=(sessionStorage.getItem(needKey(slug))??"").slice(0,NEED_MAX);if(n){setNeed(n);setForm(f=>({...f,notes:f.notes||n}))}}catch{/* storage blocked */}},[]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{const z=visitorTz();setTz(z);setWeekStart(firstDayOfWeek());const [y,m]=dayKey(Date.now(),z).split("-").map(Number);setMonth({y,m})},[]);

 const mKey=month?`${month.y}-${month.m}`:"";
 const load=useCallback(async(mo:Month,force=false)=>{
  const k=`${mo.y}-${mo.m}`;
  if(!force&&slotsByMonth[k])return;
  setLoading(true);
  // Month in UTC ± 1 day covers every timezone; only this month's days are shown.
  const start=Math.max(Date.now(),Date.UTC(mo.y,mo.m-1,1)-DAY),end=Date.UTC(mo.y,mo.m,1)+DAY;
  try{
   if(end<=start){setSlotsByMonth(s=>({...s,[k]:[]}));return}
   const r=await fetch(`/api/public/${encodeURIComponent(slug)}/availability?start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`,{cache:"no-store"});
   const data=await r.json() as {slots?:Slot[]}&ApiError;
   if(!r.ok){setMessage({tone:"error",text:data.message??"Availability can't be loaded right now."});return}
   setSlotsByMonth(s=>({...s,[k]:data.slots??[]}));
  }catch{setMessage({tone:"error",text:"Availability can't be loaded right now."})}
  finally{setLoading(false)}
 },[slug,slotsByMonth]);
 useEffect(()=>{if(month)void load(month)},[mKey]);// eslint-disable-line react-hooks/exhaustive-deps

 const byDay=useMemo(()=>{
  const map=new Map<string,Slot[]>();if(!tz||!month)return map;
  for(const s of slotsByMonth[mKey]??[]){const k=dayKey(s.start,tz);if(!k.startsWith(`${month.y}-${String(month.m).padStart(2,"0")}`))continue;map.set(k,[...(map.get(k)??[]),s])}
  return map;
 },[slotsByMonth,mKey,tz,month]);

 // Auto-select the first open day; if this month has none left, look at next month once.
 useEffect(()=>{
  if(!month||loading||!slotsByMonth[mKey])return;
  if(day&&byDay.has(day))return;
  const first=[...byDay.keys()].sort()[0];
  if(first){setDay(first);return}
  setDay(null);
  if(!autoAdvanced.current){autoAdvanced.current=true;setMonth(m=>m&&(m.m===12?{y:m.y+1,m:1}:{y:m.y,m:m.m+1}))}
 },[byDay,loading,mKey]);// eslint-disable-line react-hooks/exhaustive-deps

 const todayKey=tz?dayKey(Date.now(),tz):"";
 const lastKey=tz?dayKey(Date.now()+horizonDays*DAY,tz):"";
 const canPrev=month&&todayKey?`${month.y}-${String(month.m).padStart(2,"0")}`>todayKey.slice(0,7):false;
 const canNext=month&&lastKey?`${month.y}-${String(month.m).padStart(2,"0")}`<lastKey.slice(0,7):false;
 const shift=(d:number)=>{setDay(null);setMonth(m=>{if(!m)return m;const t=m.m+d;return t<1?{y:m.y-1,m:12}:t>12?{y:m.y+1,m:1}:{y:m.y,m:t}})};

 const backToPick=async(text?:string,tone:"warn"|"error"="warn")=>{
  setStep({name:"pick"});setMessage(text?{tone,text}:null);
  if(month)await load(month,true);
 };
 async function choose(slot:Slot){
  setBusy(true);setMessage(null);
  const r=await post("/api/public/holds",{slug,start:slot.start});
  setBusy(false);
  if(r.status===201&&typeof r.data.holdId==="string"){key.current=newKey();setStep({name:"details",holdId:r.data.holdId,slot})}
  else await backToPick(r.data.message??"That time was just taken. Please choose another.");
 }
 async function release(holdId:string){await post(`/api/public/holds/${holdId}/release`).catch(()=>undefined);await backToPick()}
 async function confirm(holdId:string,slot:Slot,attempt=0):Promise<void>{
  setBusy(true);setMessage(null);
  const r=mode.kind==="book"
   ?await post("/api/public/bookings",{holdId,idempotencyKey:key.current,name:form.name,email:form.email,notes:form.notes||undefined,timezone:tz})
   :await post("/api/public/manage/reschedule",{token:mode.token,holdId});
  const booking=r.data.booking as {start:string;end:string;visitorEmail:string|null}|undefined;
  if((r.status===200||r.status===201)&&booking){
   setBusy(false);
   if(mode.kind==="reschedule"){onRescheduled?.({start:booking.start,end:booking.end});return}
   try{sessionStorage.removeItem(needKey(slug))}catch{/* storage blocked */}
   setStep({name:"done",result:{start:booking.start,end:booking.end,email:booking.visitorEmail,manageUrl:String(r.data.manageUrl??"")}});return;
  }
  if(r.status===202){setBusy(false);setStep({name:"pending",holdId,slot});return}
  if(r.data.code==="in_progress"&&attempt<5){await new Promise(res=>setTimeout(res,1500));return confirm(holdId,slot,attempt+1)}
  setBusy(false);
  // The hold is still ours in these cases: stay on this step so the visitor can retry.
  const holdKept=r.status===400||r.status===429||r.data.code==="calendar_unavailable"||r.data.code==="in_progress"||(mode.kind==="reschedule"&&r.data.code==="provider_failed"&&r.data.retryable);
  if(holdKept){setMessage({tone:"error",text:r.data.message??"Please try again."});return}
  await backToPick(r.data.message??"Something went wrong. Please choose a time again.","error");
 }

 const Note=()=>message?<p className={`notice ${message.tone}`} role="alert">{message.text}</p>:null;
 const When=({slot}:{slot:Slot})=><div className="summary">
  <strong>{fmtFull(slot.start,tz??"UTC")}</strong>
  <span className="subtle"><IconClock size={16}/>{durationMinutes} min with {hostName}</span>
  <span className="subtle"><IconGlobe size={16}/>{tz}</span>
 </div>;

 if(!tz||!month)return <div className="stack"><div className="skeleton" style={{height:28,width:160}}/><div className="skeleton" style={{height:260}}/></div>;

 if(step.name==="done")return <section className="stack-lg" aria-live="polite">
  <div className="stack"><span className="success-mark"><IconCheck size={26}/></span><h2 className="display" style={{fontSize:36}}>You&apos;re booked</h2></div>
  <When slot={step.result}/>
  {step.result.email&&<p className="subtle" style={{margin:0}}>A calendar invitation is on its way to <b>{step.result.email}</b>.</p>}
  {step.result.manageUrl&&<p style={{margin:0}}><a className="link" href={step.result.manageUrl}>Reschedule or cancel</a></p>}
 </section>;

 if(step.name==="pending")return <section className="stack" aria-live="polite">
  <When slot={step.slot}/>
  <p className="notice warn">Your time is reserved, but the calendar hasn&apos;t confirmed it yet. You are <strong>not booked</strong> until it does. Please try again; you won&apos;t be double-booked.</p>
  <Note/>
  <button className="button primary block" disabled={busy} onClick={()=>confirm(step.holdId,step.slot)}>{busy?"Checking…":"Try again"}</button>
 </section>;

 if(step.name==="details"){
  const {slot,holdId}=step;const isBook=mode.kind==="book";
  return <section className="stack">
   <button type="button" className="back" style={{border:0,background:"none",padding:0,justifySelf:"start"}} disabled={busy} onClick={()=>release(holdId)}><IconArrowLeft size={16}/>Change time</button>
   <When slot={slot}/>
   <Note/>
   <form className="stack" onSubmit={e=>{e.preventDefault();if(!busy)void confirm(holdId,slot)}}>
    {isBook&&<>
     <label className="label">Name<input className="field" required maxLength={120} autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
     <label className="label">Email<input className="field" required type="email" maxLength={254} autoComplete="email" inputMode="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
     <label className="label"><span>{need?"What it's about":<>Anything to share beforehand? <span className="hint">Optional</span></>}</span><textarea className="field" maxLength={1000} rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    </>}
    <button type="submit" className="button accent block" disabled={busy}>{busy?"Confirming…":isBook?"Confirm booking":"Confirm new time"}</button>
    <p className="tiny" style={{margin:0,textAlign:"center"}}>This time is held for you for a few minutes.</p>
   </form>
  </section>;
 }

 // Pick: month calendar + times for the selected day.
 const daysInMonth=new Date(Date.UTC(month.y,month.m,0)).getUTCDate();
 const firstIso=new Date(Date.UTC(month.y,month.m-1,1)).getUTCDay()||7;// 1–7, Mon=1
 const lead=(firstIso-weekStart+7)%7;
 const dow=Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(undefined,{weekday:"narrow",timeZone:"UTC"}).format(new Date(Date.UTC(2024,0,1+((weekStart-1+i)%7)))));
 const monthLabel=new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(month.y,month.m-1,15)));
 const times=day?byDay.get(day)??[]:[];
 return <section>
  <Note/>
  {need&&<p className="need-quote"><span className="tiny">Your request</span>{need.length>160?`${need.slice(0,160)}…`:need}</p>}
  <div className="picker">
   <div>
    <div className="cal-head">
     <span className="cal-title">{monthLabel}</span>
     <span style={{display:"flex",gap:2}}>
      <button className="icon-button" aria-label="Previous month" disabled={!canPrev||loading} onClick={()=>shift(-1)}><IconChevronLeft/></button>
      <button className="icon-button" aria-label="Next month" disabled={!canNext||loading} onClick={()=>shift(1)}><IconChevronRight/></button>
     </span>
    </div>
    <div className="cal-grid" role="group" aria-label="Date">
     {dow.map((d,i)=><span key={i} className="cal-dow" aria-hidden="true">{d}</span>)}
     {Array.from({length:lead},(_,i)=><span key={`l${i}`}/>)}
     {Array.from({length:daysInMonth},(_,i)=>{const k=keyOf(month.y,month.m,i+1);const open=byDay.has(k);
      return <button key={k} className={`cal-day${open?" available":""}${k===todayKey?" today":""}`} disabled={!open||busy} aria-pressed={k===day} aria-label={`${fmtDayLong(k)}${open?"":", no times"}`} onClick={()=>setDay(k)}>{i+1}</button>})}
    </div>
    <p className="tz-line"><IconGlobe size={15}/>Times shown in {tz.replace(/_/g," ")}</p>
   </div>
   <div>
    <p className="times-head">{day?fmtDayLong(day):loading?"Finding free times…":"No open times this month"}</p>
    {loading&&!day?<div className="slot-grid">{Array.from({length:6},(_,i)=><div key={i} className="skeleton" style={{height:46}}/>)}</div>
     :<div className="slot-grid" role="group" aria-label="Time">{times.map(s=><button key={s.start} className="slot" disabled={busy} onClick={()=>choose(s)}>{fmtTime(s.start,tz)}</button>)}</div>}
    {!loading&&!day&&canNext&&<button className="button" style={{marginTop:12}} onClick={()=>shift(1)}>Check next month <IconCalendar size={16}/></button>}
   </div>
  </div>
 </section>;
}
