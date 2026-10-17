import {NextResponse} from "next/server";
import {getServices} from "@/server/container";
import {failureResponse,guarded,parseJson,rateLimit} from "@/server/http";
import {limiters} from "@/server/rate-limit";
import {holdRequest} from "@/server/validation";

/** Step 5: visitor picked a slot → short-lived DB hold. */
export async function POST(request:Request){return guarded("holds",async()=>{
 const limited=rateLimit(limiters.hold,request,"hold");if(limited)return limited;
 const body=await parseJson(request,holdRequest);if(!body.ok)return body.response;
 const r=await getServices().bookings.createHold(body.data.slug,body.data.start);
 return r.ok?NextResponse.json(r,{status:201}):failureResponse(r);
})}
