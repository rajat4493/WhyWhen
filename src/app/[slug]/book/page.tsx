import Link from "next/link";
import {notFound} from "next/navigation";
import {BookingFlow} from "@/app/components/booking-flow";
import {Avatar,IconArrowLeft,IconCalendar,IconClock} from "@/app/components/icons";
import {loadPublicHost} from "@/server/pages";
export const dynamic="force-dynamic";
export default async function BookingPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params; const found=await loadPublicHost(slug); if(found.state!=="ok")notFound();
 const {host,calendar}=found.ctx;
 return <main className="page wide">
  <Link className="back" href={`/${slug}`}><IconArrowLeft size={16}/>Back</Link>
  <div className="card booking" style={{marginTop:16}}>
   <aside className="booking-meta">
    <div className="host"><Avatar name={host.displayName}/><div className="host-name">{host.displayName}</div></div>
    <h1 className="display" style={{fontSize:34,marginTop:18}}>Book a time</h1>
    <ul className="meta-list">
     <li><IconClock size={18}/>{host.policy.durationMinutes} minutes</li>
     <li><IconCalendar size={18}/>Invitation sent by email</li>
    </ul>
   </aside>
   <div className="booking-main">
    {calendar?<BookingFlow slug={slug} hostName={host.displayName} durationMinutes={host.policy.durationMinutes} horizonDays={host.policy.horizonDays}/>
     :<p className="lede" style={{margin:0}}>{host.displayName} isn&apos;t accepting bookings right now.</p>}
   </div>
  </div>
  <footer className="powered"><Link href="/">WhyWhen</Link></footer>
 </main>
}
