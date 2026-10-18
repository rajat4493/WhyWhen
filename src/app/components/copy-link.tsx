"use client";
import {useState} from "react";
import {IconCheck} from "./icons";
export function CopyLink({url}:{url:string}){
 const [copied,setCopied]=useState(false);
 return <button type="button" className="button ghost" style={{minHeight:34,fontSize:14}} onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1600)}catch{/* clipboard unavailable */}}}>
  {copied?<><IconCheck size={16}/>Copied</>:"Copy"}
 </button>;
}
