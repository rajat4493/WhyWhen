import {NextResponse} from "next/server";
import {getServices} from "@/server/container";
import {verifyManageToken} from "@/server/crypto";
import {failureResponse,guarded,parseJson,rateLimit} from "@/server/http";
import {limiters} from "@/server/rate-limit";
import {cancelRequest} from "@/server/validation";

export async function POST(request:Request){return guarded("manage.cancel",async()=>{
 const limited=rateLimit(limiters.manage,request,"manage");if(limited)return limited;
 const body=await parseJson(request,cancelRequest);if(!body.ok)return body.response;
 const {bookings,env}=getServices();
 const bookingId=verifyManageToken(body.data.token,env.SESSION_SECRET);
 if(!bookingId)return NextResponse.json({code:"booking_not_found",message:"This link is not valid."},{status:404});
 const r=await bookings.cancel(bookingId);
 return r.ok?NextResponse.json(r):failureResponse(r);
})}
