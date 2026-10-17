import Link from "next/link";
import {notFound} from "next/navigation";
import {loadPublicHost} from "@/server/pages";
export const dynamic="force-dynamic";
export default async function PublicIntentPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params; const found=await loadPublicHost(slug); if(found.state!=="ok")notFound();
 const displayName=found.ctx.host.displayName;
 return <main className="shell">
  <div className="brand"><span className="brand-mark"/>{displayName}</div>
  <p className="eyebrow">What would you like to do with {displayName}?</p>
  <h1>What do you need?</h1>
  <p className="lede">Describe what you need in your own words, or skip ahead and book a time directly.</p>
  <form className="card" action="/api/intent" method="post"><input type="hidden" name="slug" value={slug}/><textarea className="intent-box" name="intent" placeholder={`I’d like ${displayName} to…`} aria-label="What do you need?" required/><div className="actions"><Link className="button" href={`/${slug}/book`}>Book a time directly</Link><button className="button primary" type="submit">Continue</button></div></form>
 </main>
}
