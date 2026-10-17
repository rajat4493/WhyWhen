"use client";
import {useEffect,useState} from "react";
import {BookingFlow,fmtFull} from "./booking-flow";

type Booking={id:string;status:string;start:string;end:string;hostName:string;hostSlug:string;durationMinutes:number;visitorEmail:string|null};

export function ManageBooking({token,booking:initial,canReschedule}:{token:string;booking:Booking;canReschedule:boolean}){
 const [booking,setBooking]=useState(initial);
 const [tz,setTz]=useState("UTC");
 const [mode,setMode]=useState<"view"|"confirm-cancel"|"reschedule">("view");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState<{tone:"warn"|"error";text:string}|null>(null);
 useEffect(()=>{try{setTz(Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC")}catch{/* keep UTC */}},[]);

 async function cancel(){
  setBusy(true);setMessage(null);
  const r=await fetch("/api/public/manage/cancel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
  const d=await r.json().catch(()=>({})) as {message?:string;booking?:Booking};
  setBusy(false);
  if(r.ok&&d.booking){setBooking({...booking,status:"cancelled"});setMode("view")}else setMessage({tone:"error",text:d.message??"Cancellation failed. Your booking is unchanged."});
 }

 const active=booking.status==="confirmed"||booking.status==="needs_reconciliation";
 return <>
  <section className="section panel stack" aria-live="polite">
   <p className="summary"><strong>{fmtFull(booking.start,tz)}</strong>{booking.durationMinutes} minutes with {booking.hostName} · {tz}</p>
   {booking.status==="cancelled"&&<p className="notice">This booking is cancelled.</p>}
   {booking.status==="needs_reconciliation"&&<p className="notice warn">The calendar hasn&apos;t confirmed the latest change yet. {booking.hostName} has been notified in their dashboard.</p>}
   {booking.status==="failed"&&<p className="notice error">This booking was not completed.</p>}
   {message&&<p className={`notice ${message.tone}`} role="alert">{message.text}</p>}
   {active&&mode==="view"&&<div className="actions">
    {canReschedule&&<button className="button" onClick={()=>{setMessage(null);setMode("reschedule")}}>Reschedule</button>}
    <button className="button" onClick={()=>{setMessage(null);setMode("confirm-cancel")}}>Cancel booking</button>
   </div>}
   {mode==="confirm-cancel"&&<div className="actions">
    <span>Cancel this meeting? {booking.hostName} and you will get a calendar update.</span>
    <div style={{display:"flex",gap:10}}><button className="button" disabled={busy} onClick={()=>setMode("view")}>Keep it</button><button className="button primary" disabled={busy} onClick={cancel}>{busy?"Cancelling…":"Yes, cancel"}</button></div>
   </div>}
  </section>
  {mode==="reschedule"&&<>
   <BookingFlow slug={booking.hostSlug} hostName={booking.hostName} durationMinutes={booking.durationMinutes} mode={{kind:"reschedule",token}} onRescheduled={slot=>{setBooking({...booking,...slot,status:"confirmed"});setMode("view");setMessage({tone:"warn",text:"Moved. Everyone received an updated invitation."})}}/>
   <p><button className="button" onClick={()=>setMode("view")}>Keep current time</button></p>
  </>}
 </>;
}
