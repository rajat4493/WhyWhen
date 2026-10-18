import Link from "next/link";
import {notFound} from "next/navigation";
import {Avatar,IconArrowRight,IconCalendar} from "@/app/components/icons";
import {loadPublicHost} from "@/server/pages";
export const dynamic="force-dynamic";
export default async function PublicIntentPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params; const found=await loadPublicHost(slug); if(found.state!=="ok")notFound();
 const {host,calendar}=found.ctx;const first=host.displayName.split(/\s+/)[0];
 return <main className="page">
  <header className="host"><Avatar name={host.displayName}/><div><div className="host-name">{host.displayName}</div><div className="subtle">{host.policy.durationMinutes}-minute meetings</div></div></header>
  <div className="grow" style={{marginTop:48}}>
   <h1 className="display">What do you <em>need</em>?</h1>
   <p className="lede">Tell {first} what you&apos;re after in plain words. If a conversation is the right next step, you&apos;ll pick a time.</p>
   <form className="card composer" action="/api/intent" method="post">
    <input type="hidden" name="slug" value={slug}/>
    <textarea name="intent" placeholder={`I'd like ${first} to…`} aria-label="What do you need?" required/>
    <div className="composer-foot"><span className="tiny">No account needed</span><button className="button primary" type="submit">Continue</button></div>
   </form>
   {calendar&&<Link className="direct" href={`/${slug}/book`}>
    <span className="ico"><IconCalendar/></span>
    <span><span className="t" style={{display:"block"}}>Book a time directly</span><span className="s">{host.policy.durationMinutes} min · see {first}&apos;s free times</span></span>
    <span className="go"><IconArrowRight/></span>
   </Link>}
  </div>
  <footer className="powered"><Link href="/">WhyWhen</Link></footer>
 </main>
}
