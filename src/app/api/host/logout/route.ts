import {NextResponse} from "next/server";
import {getServices} from "@/server/container";
import {guarded,sameOrigin} from "@/server/http";
import {SESSION_COOKIE,cookieOptions} from "@/server/session";

export async function POST(request:Request){return guarded("host.logout",async()=>{
 const {env}=getServices();
 if(!sameOrigin(request,env.appUrl))return NextResponse.json({code:"forbidden"},{status:403});
 const r=NextResponse.redirect(new URL("/dashboard",env.appUrl),303);
 r.cookies.set(SESSION_COOKIE,"",cookieOptions(0));
 return r;
})}
