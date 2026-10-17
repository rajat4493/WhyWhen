import {NextResponse} from "next/server";
import {getServices} from "@/server/container";
import {failureResponse,guarded,parseJson,rateLimit} from "@/server/http";
import {limiters} from "@/server/rate-limit";
import {confirmRequest} from "@/server/validation";

/**
 * Steps 6–10. 201 confirmed · 200 duplicate of a confirmed request · 202 reserved but calendar outcome unknown
 * (never shown as booked; retry with the same idempotency key).
 */
export async function POST(request:Request){return guarded("bookings",async()=>{
 const limited=rateLimit(limiters.booking,request,"booking");if(limited)return limited;
 const body=await parseJson(request,confirmRequest);if(!body.ok)return body.response;
 const d=body.data;
 const r=await getServices().bookings.confirm({holdId:d.holdId,idempotencyKey:d.idempotencyKey,visitorName:d.name,visitorEmail:d.email,visitorTimezone:d.timezone,notes:d.notes});
 if(!r.ok)return failureResponse(r);
 return NextResponse.json(r,{status:r.outcome==="needs_reconciliation"?202:r.duplicate?200:201});
})}
