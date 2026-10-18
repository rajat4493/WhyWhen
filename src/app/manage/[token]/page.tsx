import Link from "next/link";
import {notFound} from "next/navigation";
import {ManageBooking} from "@/app/components/manage-booking";
import {Avatar} from "@/app/components/icons";
import {getServices} from "@/server/container";
import {verifyManageToken} from "@/server/crypto";
import {manageTokenSchema} from "@/server/validation";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
export default async function ManagePage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!manageTokenSchema.safeParse(token).success)notFound();
 const {bookings,env}=getServices();
 const bookingId=verifyManageToken(token,env.SESSION_SECRET);if(!bookingId)notFound();
 const found=await bookings.getBooking(bookingId);if(!found)notFound();
 const {booking,calendarConnected}=found;
 return <main className="page wide">
  <div className="card booking">
   <aside className="booking-meta">
    <div className="host"><Avatar name={booking.hostName}/><div className="host-name">{booking.hostName}</div></div>
    <h1 className="display" style={{fontSize:34,marginTop:18}}>Your booking</h1>
   </aside>
   <div className="booking-main"><ManageBooking token={token} booking={booking} canReschedule={calendarConnected}/></div>
  </div>
  <footer className="powered"><Link href="/">WhyWhen</Link></footer>
 </main>
}
