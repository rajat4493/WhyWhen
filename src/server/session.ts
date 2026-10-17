import "server-only";
import {randomToken,sha256b64url,sign,verifySigned,constantTimeEqual} from "./crypto";

export const SESSION_COOKIE="ws_session";
export const OAUTH_COOKIE="ws_oauth";
export const SESSION_TTL_SECONDS=7*86_400;
export const OAUTH_STATE_TTL_SECONDS=600;

export function cookieOptions(maxAge:number,path="/"){return{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path,maxAge}}

/** Stateless signed host session: `{hostId, exp}`. HTTP-only; never readable by page scripts. */
export function createSession(hostId:string,secret:string,now:Date){return sign(JSON.stringify({hostId,exp:now.getTime()+SESSION_TTL_SECONDS*1000}),secret,"session")}
export function readSession(value:string|undefined,secret:string,now:Date):string|null{
 const raw=verifySigned(value,secret,"session");if(!raw)return null;
 try{const s=JSON.parse(raw) as {hostId?:unknown;exp?:unknown};return typeof s.hostId==="string"&&typeof s.exp==="number"&&s.exp>now.getTime()?s.hostId:null}catch{return null}
}

/** OAuth `state` + PKCE verifier kept in a signed, short-lived, HTTP-only cookie (single use). */
export function createOAuthState(secret:string,now:Date){
 const state=randomToken(24),verifier=randomToken(48);
 return{state,verifier,codeChallenge:sha256b64url(verifier),cookie:sign(JSON.stringify({state,verifier,exp:now.getTime()+OAUTH_STATE_TTL_SECONDS*1000}),secret,"oauth-state")};
}
export type OAuthStateCheck={ok:true;verifier:string}|{ok:false;reason:"missing"|"tampered"|"expired"|"mismatch"};
export function verifyOAuthState(cookie:string|undefined,stateParam:string|null,secret:string,now:Date):OAuthStateCheck{
 if(!cookie||!stateParam)return{ok:false,reason:"missing"};
 const raw=verifySigned(cookie,secret,"oauth-state");if(!raw)return{ok:false,reason:"tampered"};
 let s:{state?:string;verifier?:string;exp?:number};try{s=JSON.parse(raw)}catch{return{ok:false,reason:"tampered"}}
 if(typeof s.exp!=="number"||s.exp<=now.getTime())return{ok:false,reason:"expired"};
 if(typeof s.state!=="string"||typeof s.verifier!=="string"||!constantTimeEqual(s.state,stateParam))return{ok:false,reason:"mismatch"};
 return{ok:true,verifier:s.verifier};
}
