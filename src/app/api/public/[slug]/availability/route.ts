import {NextResponse} from "next/server";
import {getServices} from "@/server/container";
import {badRequest,failureResponse,guarded,rateLimit} from "@/server/http";
import {limiters} from "@/server/rate-limit";
import {availabilityQuery,slugSchema} from "@/server/validation";

/** Steps 1–3. Returns free slots only; busy-event details never leave the server. */
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){return guarded("availability",async()=>{
 const limited=rateLimit(limiters.availability,request,"availability");if(limited)return limited;
 const slug=slugSchema.safeParse((await params).slug);const url=new URL(request.url);
 const q=availabilityQuery.safeParse({start:url.searchParams.get("start"),end:url.searchParams.get("end")});
 if(!slug.success||!q.success)return badRequest();
 const r=await getServices().bookings.listSlots(slug.data,q.data);
 return r.ok?NextResponse.json(r,{headers:{"Cache-Control":"no-store"}}):failureResponse(r);
})}
