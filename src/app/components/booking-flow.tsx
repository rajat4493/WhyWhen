"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";

type Slot={start:string;end:string};
type Mode={kind:"book"}|{kind:"reschedule";token:string};
type ApiError={code?:string;message?:string;retryable?:boolean};
type Done={start:string;end:string;email:string|null;manageUrl:string};
type Step={name:"pick"}|{name:"details";holdId:string;slot:Slot}|{name:"done";result:Done}|{name:"pending";holdId:string;slot:Slot};

const WINDOW_DAYS=14;
const visitorTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}catch{return"UTC"}};
const dayKey=(iso:string,tz:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));
const fmtDay=(iso:string,tz:string)=>new Intl.DateTimeFormat(undefined,{timeZone:tz,weekday:"short",month:"short",day:"numeric"}).format(new Date(iso));
const fmtTime=(iso:string,tz:string)=>new Intl.DateTimeFormat(undefined,{timeZone:tz,hour:"numeric",minute:"2-digit"}).format(new Date(iso));
export const fmtFull=(iso:string,tz:string)=>new Intl.DateTimeFormat(undefined,{timeZone:tz,weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(iso));
const newKey=()=>crypto.randomUUID().replace(/-/g,"");

async function post(url:string,body?:unknown){
 const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json().catch(()=>({})) as Record<string,unknown>&ApiError;
 return{status:r.status,data};
}

export function BookingFlow({slug,hostName,durationMinutes,mode={kind:"book"},onRescheduled}:{slug:string;hostName:string;durationMinutes:number;mode?:Mode;onRescheduled?:(slot:Slot)=>void}){
 const [tz,setTz]=useState("UTC");
 const [slots,setSlots]=useState<Slot[]>([]);
 const [loadedUntil,setLoadedUntil]=useState<number|null>(null);
 const [loading,setLoading]=useState(true);
 const [day,setDay]=useState<string|null>(null);
 const [step,setStep]=useState<Step>({name:"pick"});
 const [message,setMessage]=useState<{tone:"warn"|"error";text:string}|null>(null);
 const [busy,setBusy]=useState(false);
 const [form,setForm]=useState({name:"",email:"",notes:""});
 const key=useRef<string>("");

 const load=useCallback(async(fromMs:number,reset:boolean)=>{
  setLoading(true);
  const to=fromMs+WINDOW_DAYS*86_400_000;
  try{
   const r=await fetch(`/api/public/${encodeURIComponent(slug)}/availability?start=${new Date(fromMs).toISOString()}&end=${new Date(to).toISOString()}`,{cache:"no-store"});
   const data=await r.json() as {slots?:Slot[]}&ApiError;
   if(!r.ok){setMessage({tone:"error",text:data.message??"Availability can't be loaded right now."});return}
   setSlots(prev=>reset?data.slots??[]:[...prev,...(data.slots??[])]);setLoadedUntil(to);
  }catch{setMessage({tone:"error",text:"Availability can't be loaded right now."})}
  finally{setLoading(false)}
 },[slug]);

 useEffect(()=>{setTz(visitorTz());void load(Date.now(),true)},[load]);

 const byDay=useMemo(()=>{const m=new Map<string,Slot[]>();for(const s of slots){const k=dayKey(s.start,tz);m.set(k,[...(m.get(k)??[]),s])}return m},[slots,tz]);
 const days=[...byDay.keys()];
 const activeDay=day&&byDay.has(day)?day:days[0]??null;

 const backToPick=async(text?:string,tone:"warn"|"error"="warn",refresh=true)=>{
  setStep({name:"pick"});setMessage(text?{tone,text}:null);
  if(refresh)await load(Date.now(),true);
 };

 async function choose(slot:Slot){
  setBusy(true);setMessage(null);
  const r=await post("/api/public/holds",{slug,start:slot.start});
  setBusy(false);
  if(r.status===201&&typeof r.data.holdId==="string"){key.current=newKey();setStep({name:"details",holdId:r.data.holdId,slot})}
  else await backToPick(r.data.message??"That time is no longer available.");
 }

 async function release(holdId:string){await post(`/api/public/holds/${holdId}/release`).catch(()=>undefined);await backToPick(undefined,"warn",true)}

 async function confirm(holdId:string,slot:Slot,attempt=0):Promise<void>{
  setBusy(true);setMessage(null);
  const r=mode.kind==="book"
   ?await post("/api/public/bookings",{holdId,idempotencyKey:key.current,name:form.name,email:form.email,notes:form.notes||undefined,timezone:tz})
   :await post("/api/public/manage/reschedule",{token:mode.token,holdId});
  const booking=r.data.booking as {start:string;end:string;visitorEmail:string|null}|undefined;
  if((r.status===200||r.status===201)&&booking){
   setBusy(false);
   if(mode.kind==="reschedule"){onRescheduled?.({start:booking.start,end:booking.end});return}
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

 if(step.name==="done")return <section className="section panel stack" aria-live="polite">
  <p className="eyebrow">You&apos;re booked</p>
  <p className="summary"><strong>{fmtFull(step.result.start,tz)}</strong>{durationMinutes} minutes with {hostName} · {tz}</p>
  {step.result.email&&<p className="subtle">A calendar invitation was sent to {step.result.email}.</p>}
  {step.result.manageUrl&&<p className="subtle">Need to change it? <a href={step.result.manageUrl} style={{textDecoration:"underline"}}>Reschedule or cancel</a></p>}
 </section>;

 if(step.name==="pending")return <section className="section panel stack" aria-live="polite">
  <p className="notice warn">Your time is reserved, but the calendar hasn&apos;t confirmed it yet. You are <strong>not booked</strong> until it does. Please try again; you won&apos;t be double-booked.</p>
  {message&&<p className={`notice ${message.tone}`}>{message.text}</p>}
  <button className="button primary" disabled={busy} onClick={()=>confirm(step.holdId,step.slot)}>{busy?"Checking…":"Try again"}</button>
 </section>;

 if(step.name==="details"){
  const {slot,holdId}=step;
  const isBook=mode.kind==="book";
  return <section className="section panel stack">
   <p className="summary"><strong>{fmtFull(slot.start,tz)}</strong>{durationMinutes} minutes with {hostName} · {tz}</p>
   <p className="subtle">This time is held for you for a few minutes.</p>
   {message&&<p className={`notice ${message.tone}`} role="alert">{message.text}</p>}
   <form className="stack" onSubmit={e=>{e.preventDefault();if(!busy)void confirm(holdId,slot)}}>
    {isBook&&<>
     <label className="label">Name<input className="field" required maxLength={120} autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
     <label className="label">Email<input className="field" required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
     <label className="label">Anything to share beforehand? (optional)<textarea className="field" maxLength={1000} rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    </>}
    <div className="actions">
     <button type="button" className="button" disabled={busy} onClick={()=>release(holdId)}>Back</button>
     <button type="submit" className="button primary" disabled={busy}>{busy?"Confirming…":isBook?"Confirm booking":"Confirm new time"}</button>
    </div>
   </form>
  </section>;
 }

 return <section className="section panel stack">
  <div className="row"><strong>{durationMinutes} minutes</strong><span className="pill">{tz}</span></div>
  {message&&<p className={`notice ${message.tone}`} role="alert">{message.text}</p>}
  {loading&&slots.length===0?<p className="subtle">Loading available times…</p>:days.length===0?<p className="subtle">No open times in this period.</p>:<>
   <div className="date-row" role="group" aria-label="Date">{days.map(d=><button key={d} className="date-chip" aria-pressed={d===activeDay} onClick={()=>setDay(d)}>{fmtDay(byDay.get(d)![0].start,tz)}</button>)}</div>
   <div className="slot-grid" role="group" aria-label="Time">{(activeDay?byDay.get(activeDay)??[]:[]).map(s=><button key={s.start} className="slot" disabled={busy} onClick={()=>choose(s)}>{fmtTime(s.start,tz)}</button>)}</div>
  </>}
  {loadedUntil&&!loading&&<button className="button" onClick={()=>load(loadedUntil,false)}>Later dates</button>}
 </section>;
}
