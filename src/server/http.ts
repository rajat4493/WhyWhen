import "server-only";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import type {z} from "zod";
import type {Failure,FailureCode} from "@/core/booking/service";
import {ConfigurationError} from "./env";
import {logEvent} from "./log";
import type {FixedWindowRateLimiter} from "./rate-limit";
import {SESSION_COOKIE,readSession} from "./session";

const STATUS:Record<FailureCode,number>={host_not_found:404,calendar_not_connected:409,calendar_unavailable:503,invalid_range:400,invalid_slot:400,slot_unavailable:409,hold_not_found:404,hold_expired:410,in_progress:409,provider_failed:502,booking_not_found:404,not_allowed:409};

export function failureResponse(f:Failure){return NextResponse.json({code:f.code,message:f.message,retryable:f.retryable},{status:STATUS[f.code]})}
export function badRequest(message="Invalid request"){return NextResponse.json({code:"invalid_request",message},{status:400})}

/** Behind Vercel/most proxies the first X-Forwarded-For entry is the client. */
export function clientIp(request:Request){return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||request.headers.get("x-real-ip")||"unknown"}

export function rateLimit(limiter:FixedWindowRateLimiter,request:Request,scope:string){
 const r=limiter.check(`${scope}:${clientIp(request)}`);
 return r.allowed?null:NextResponse.json({code:"rate_limited",message:"Too many requests. Please wait a moment."},{status:429,headers:{"Retry-After":String(r.retryAfterSeconds)}});
}

export async function parseJson<T extends z.ZodType>(request:Request,schema:T):Promise<{ok:true;data:z.infer<T>}|{ok:false;response:NextResponse}>{
 const len=Number(request.headers.get("content-length")??0);if(len>16_384)return{ok:false,response:badRequest("Request too large")};
 let body:unknown;try{body=await request.json()}catch{return{ok:false,response:badRequest("Body must be JSON")}}
 const parsed=schema.safeParse(body);
 return parsed.success?{ok:true,data:parsed.data}:{ok:false,response:badRequest(parsed.error.issues[0]?.message??"Invalid request")};
}

/** Uniform handling of unexpected errors: no stack traces or provider bodies reach the client. */
export async function guarded(route:string,fn:()=>Promise<Response>):Promise<Response>{
 try{return await fn()}catch(err){
  if(err instanceof ConfigurationError){logEvent("config.incomplete",{route,detail:err.message});return NextResponse.json({code:"not_configured",message:"This service is not configured yet."},{status:503})}
  logEvent("request.error",{route,error:err instanceof Error?err.name:"unknown"});
  return NextResponse.json({code:"internal_error",message:"Something went wrong. Please try again; retrying is safe."},{status:500});
 }
}

export async function sessionHostId(secret:string){return readSession((await cookies()).get(SESSION_COOKIE)?.value,secret,new Date())}

/** Host mutations must come from our own pages (defence in depth on top of SameSite=Lax cookies). */
export function sameOrigin(request:Request,appUrl:string){const o=request.headers.get("origin");return o!==null&&o===new URL(appUrl).origin}
