import {NextResponse,type NextRequest} from "next/server";
import {isValidTimeZone} from "@/core/availability/timezone";
import {getServices} from "@/server/container";
import {guarded,rateLimit} from "@/server/http";
import {logEvent} from "@/server/log";
import {OAuthError,missingScopes} from "@/server/oauth/google";
import {limiters} from "@/server/rate-limit";
import {OAUTH_COOKIE,SESSION_COOKIE,SESSION_TTL_SECONDS,cookieOptions,createSession,verifyOAuthState} from "@/server/session";

export async function GET(request:NextRequest){return guarded("oauth.callback",async()=>{
 const limited=rateLimit(limiters.oauth,request,"oauth");if(limited)return limited;
 const {env,oauth,hosts,google}=getServices();
 const url=new URL(request.url);
 const back=(query:string)=>{const r=NextResponse.redirect(new URL(`/dashboard?${query}`,env.appUrl));r.cookies.set(OAUTH_COOKIE,"",cookieOptions(0,"/api/oauth/google"));return r};
 const check=verifyOAuthState(request.cookies.get(OAUTH_COOKIE)?.value,url.searchParams.get("state"),env.SESSION_SECRET,new Date());
 if(!check.ok){logEvent("oauth.state_rejected",{reason:check.reason});return back("error=state")}
 if(url.searchParams.get("error"))return back("error=denied");
 const code=url.searchParams.get("code");if(!code)return back("error=denied");
 try{
  const tokens=await oauth.exchangeCode(code,check.verifier);
  if(missingScopes(tokens.scope,env.googleScopes).length){await oauth.revoke(tokens.accessToken);return back("error=scopes")}
  const identity=await oauth.identity(tokens.accessToken);
  const {hostId,created}=await hosts.upsertGoogleHost(identity);
  let refreshToken=tokens.refreshToken;
  if(!refreshToken){const prev=await hosts.connection(hostId);if(prev)refreshToken=(await hosts.load(prev.accountId))?.tokens?.refreshToken??null}
  if(!refreshToken)return back("error=offline");
  await hosts.saveGoogleConnection(hostId,{externalAccountId:identity.sub,email:identity.email,tokens:{...tokens,refreshToken}});
  if(created){
   // Best effort: start the host in their primary calendar's timezone.
   const ctx=await hosts.getById(hostId);
   const tz=ctx?.calendar?(await google.listCalendars(ctx.calendar).catch(()=>[])).find(c=>c.primary)?.timezone:undefined;
   if(tz&&isValidTimeZone(tz))await hosts.setTimezone(hostId,tz);
  }
  logEvent("oauth.connected",{hostId,created});
  const r=back("connected=1");
  r.cookies.set(SESSION_COOKIE,createSession(hostId,env.SESSION_SECRET,new Date()),cookieOptions(SESSION_TTL_SECONDS));
  return r;
 }catch(err){
  logEvent("oauth.callback_failed",{error:err instanceof OAuthError?err.message:err instanceof Error?err.name:"unknown"});
  return back("error=google");
 }
})}
