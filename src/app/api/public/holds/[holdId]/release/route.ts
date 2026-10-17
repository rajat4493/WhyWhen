import {NextResponse} from "next/server";
import {getServices} from "@/server/container";
import {badRequest,guarded,rateLimit} from "@/server/http";
import {limiters} from "@/server/rate-limit";
import {uuidSchema} from "@/server/validation";

/** Visitor went back: free the slot now instead of waiting for expiry. Unknown/consumed holds are a no-op. */
export async function POST(request:Request,{params}:{params:Promise<{holdId:string}>}){return guarded("hold.release",async()=>{
 const limited=rateLimit(limiters.hold,request,"hold-release");if(limited)return limited;
 const id=uuidSchema.safeParse((await params).holdId);if(!id.success)return badRequest();
 await getServices().bookings.releaseHold(id.data);
 return NextResponse.json({ok:true});
})}
