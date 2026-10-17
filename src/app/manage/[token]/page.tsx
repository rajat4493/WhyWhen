import {notFound} from "next/navigation";
import {ManageBooking} from "@/app/components/manage-booking";
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
 return <main className="shell">
  <div className="brand"><span className="brand-mark"/>{booking.hostName}</div>
  <p className="eyebrow">Your booking</p><h1>Manage your time.</h1>
  <ManageBooking token={token} booking={booking} canReschedule={calendarConnected}/>
 </main>
}
