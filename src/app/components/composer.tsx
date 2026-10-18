"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";

/** Session-storage key for the visitor's typed request; kept out of URLs and server logs. */
export const needKey=(slug:string)=>`whywhen:need:${slug}`;
export const NEED_MAX=1000;

/**
 * "What do you need?" box. Until AI routing (M3) exists, Continue carries the request into direct booking:
 * it pre-fills the booking notes, which land in the calendar event description.
 */
export function Composer({slug,firstName}:{slug:string;firstName:string}){
 const router=useRouter();const [text,setText]=useState("");
 return <form className="card composer" action={`/${slug}/book`} onSubmit={e=>{
  e.preventDefault();
  try{sessionStorage.setItem(needKey(slug),text.trim().slice(0,NEED_MAX))}catch{/* storage blocked: booking still works */}
  router.push(`/${slug}/book`);
 }}>
  <textarea value={text} onChange={e=>setText(e.target.value)} maxLength={NEED_MAX} placeholder={`I'd like ${firstName} to…`} aria-label="What do you need?" required/>
  <div className="composer-foot"><span className="tiny">No account needed</span><button className="button primary" type="submit">Continue</button></div>
 </form>;
}
