import {NextResponse} from "next/server";
import {getServices} from "@/server/container";
import {guarded,rateLimit} from "@/server/http";
import {limiters} from "@/server/rate-limit";
import {OAUTH_COOKIE,OAUTH_STATE_TTL_SECONDS,cookieOptions,createOAuthState} from "@/server/session";

/** Host sign-in = Google Calendar connection (OAuth 2.0 authorization code + PKCE + state). */
export async function GET(request:Request){return guarded("oauth.start",async()=>{
 const limited=rateLimit(limiters.oauth,request,"oauth");if(limited)return limited;
 const {env,oauth}=getServices();
 const s=createOAuthState(env.SESSION_SECRET,new Date());
 const response=NextResponse.redirect(oauth.authorizationUrl({state:s.state,codeChallenge:s.codeChallenge}));
 response.cookies.set(OAUTH_COOKIE,s.cookie,cookieOptions(OAUTH_STATE_TTL_SECONDS,"/api/oauth/google"));
 return response;
})}
