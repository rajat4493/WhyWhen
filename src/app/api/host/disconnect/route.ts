import {NextResponse} from "next/server";
import {getServices} from "@/server/container";
import {guarded,sameOrigin,sessionHostId} from "@/server/http";
import {logEvent} from "@/server/log";

/** Revokes Google access (best effort) and wipes stored credentials. Public booking stops immediately. */
export async function POST(request:Request){return guarded("host.disconnect",async()=>{
 const {env,hosts,oauth}=getServices();
 if(!sameOrigin(request,env.appUrl))return NextResponse.json({code:"forbidden"},{status:403});
 const hostId=await sessionHostId(env.SESSION_SECRET);if(!hostId)return NextResponse.json({code:"unauthorized"},{status:401});
 const token=await hosts.disconnect(hostId);
 const revoked=token?await oauth.revoke(token):true;
 logEvent("oauth.disconnected",{hostId,revokedAtGoogle:revoked});
 return NextResponse.redirect(new URL("/dashboard?disconnected=1",env.appUrl),303);
})}
