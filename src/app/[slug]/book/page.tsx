import Link from "next/link";
import {notFound} from "next/navigation";
import {BookingFlow} from "@/app/components/booking-flow";
import {loadPublicHost} from "@/server/pages";
export const dynamic="force-dynamic";
export default async function BookingPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params; const found=await loadPublicHost(slug); if(found.state!=="ok")notFound();
 const {host,calendar}=found.ctx;
 return <main className="shell">
  <div className="brand"><span className="brand-mark"/><Link href={`/${slug}`}>{host.displayName}</Link></div>
  <p className="eyebrow">Direct booking</p><h1>Choose a time.</h1>
  {calendar?<BookingFlow slug={slug} hostName={host.displayName} durationMinutes={host.policy.durationMinutes}/>:<p className="lede">{host.displayName} isn&apos;t accepting bookings right now.</p>}
 </main>
}
