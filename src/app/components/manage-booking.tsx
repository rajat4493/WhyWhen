"use client";
import {useEffect,useState} from "react";
import {BookingFlow,fmtFull} from "./booking-flow";
import {IconArrowLeft,IconClock,IconGlobe} from "./icons";

type Booking={id:string;status:string;start:string;end:string;hostName:string;hostSlug:string;durationMinutes:number;visitorEmail:string|null};

export function ManageBooking({token,booking:initial,canReschedule}:{token:string;booking:Booking;canReschedule:boolean}){
 const [booking,setBooking]=useState(initial);
 const [tz,setTz]=useState("UTC");
 const [mode,setMode]=useState<"view"|"confirm-cancel"|"reschedule">("view");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState<{tone:"ok"|"warn"|"error";text:string}|null>(null);
 useEffect(()=>{try{setTz(Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC")}catch{/* keep UTC */}},[]);

 async function cancel(){
  setBusy(true);setMessage(null);
  const r=await fetch("/api/public/manage/cancel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
  const d=await r.json().catch(()=>({})) as {message?:string;booking?:Booking};
  setBusy(false);
  if(r.ok&&d.booking){setBooking({...booking,status:"cancelled"});setMode("view")}else setMessage({tone:"error",text:d.message??"Cancellation failed. Your booking is unchanged."});
 }

 if(mode==="reschedule")return <section className="stack">
  <button type="button" className="back" style={{border:0,background:"none",padding:0,justifySelf:"start"}} onClick={()=>setMode("view")}><IconArrowLeft size={16}/>Keep current time</button>
  <BookingFlow slug={booking.hostSlug} hostName={booking.hostName} durationMinutes={booking.durationMinutes} mode={{kind:"reschedule",token}} onRescheduled={slot=>{setBooking({...booking,...slot,status:"confirmed"});setMode("view");setMessage({tone:"ok",text:"Moved. Everyone received an updated invitation."})}}/>
 </section>;

 const active=booking.status==="confirmed"||booking.status==="needs_reconciliation";
 return <section className="stack" aria-live="polite">
  <div className="summary">
   <strong style={booking.status==="cancelled"?{textDecoration:"line-through",color:"var(--muted)"}:undefined}>{fmtFull(booking.start,tz)}</strong>
   <span className="subtle"><IconClock size={16}/>{booking.durationMinutes} min with {booking.hostName}</span>
   <span className="subtle"><IconGlobe size={16}/>{tz}</span>
  </div>
  {booking.status==="cancelled"&&<p className="notice">This booking is cancelled.</p>}
  {booking.status==="needs_reconciliation"&&<p className="notice warn">The calendar hasn&apos;t confirmed the latest change yet. {booking.hostName} can see this on their dashboard.</p>}
  {booking.status==="failed"&&<p className="notice error">This booking was not completed.</p>}
  {message&&<p className={`notice ${message.tone}`} role="alert">{message.text}</p>}
  {active&&mode==="view"&&<div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
   {canReschedule&&<button className="button primary" onClick={()=>{setMessage(null);setMode("reschedule")}}>Reschedule</button>}
   <button className="button" onClick={()=>{setMessage(null);setMode("confirm-cancel")}}>Cancel booking</button>
  </div>}
  {mode==="confirm-cancel"&&<div className="notice stack">
   <span>Cancel this meeting? You and {booking.hostName} will both get a calendar update.</span>
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="button" disabled={busy} onClick={()=>setMode("view")}>Keep it</button><button className="button primary" disabled={busy} onClick={cancel}>{busy?"Cancelling…":"Yes, cancel"}</button></div>
  </div>}
 </section>;
}
