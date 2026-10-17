import "server-only";

const AUTH_URL="https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL="https://oauth2.googleapis.com/token";
const REVOKE_URL="https://oauth2.googleapis.com/revoke";
const USERINFO_URL="https://openidconnect.googleapis.com/v1/userinfo";
const TIMEOUT_MS=10_000;

/**
 * Least-privilege default. ASSUMPTION (not yet observed live): `calendar.freebusy` authorizes freeBusy.query.
 * Override with GOOGLE_OAUTH_SCOPES (space-separated) without a code change if Google rejects it.
 */
export const DEFAULT_GOOGLE_SCOPES=["openid","email","profile","https://www.googleapis.com/auth/calendar.calendarlist.readonly","https://www.googleapis.com/auth/calendar.freebusy","https://www.googleapis.com/auth/calendar.events.owned"];
export const REQUIRED_CALENDAR_SCOPE_PREFIX="https://www.googleapis.com/auth/calendar";

export type GoogleOAuthConfig={clientId:string;clientSecret:string;redirectUri:string;scopes:string[]};
export type GoogleTokens={accessToken:string;refreshToken:string|null;expiresAt:number;scope:string};
export type GoogleIdentity={sub:string;email:string;name:string|null};

/** `invalid_grant` = refresh token revoked/expired → user must reconnect. Other codes are transient or config errors. */
export class OAuthError extends Error{constructor(readonly code:string,readonly status?:number){super(`Google OAuth error: ${code}`);this.name="OAuthError"}
 get revoked(){return this.code==="invalid_grant"}}

export class GoogleOAuthClient{
 constructor(private readonly config:GoogleOAuthConfig,private readonly fetchImpl:typeof fetch=fetch,private readonly now:()=>Date=()=>new Date()){}

 authorizationUrl(input:{state:string;codeChallenge:string}){
  const u=new URL(AUTH_URL);
  for(const [k,v] of Object.entries({client_id:this.config.clientId,redirect_uri:this.config.redirectUri,response_type:"code",scope:this.config.scopes.join(" "),access_type:"offline",prompt:"consent",include_granted_scopes:"true",state:input.state,code_challenge:input.codeChallenge,code_challenge_method:"S256"}))u.searchParams.set(k,v);
  return u.toString();
 }

 private async tokenRequest(params:Record<string,string>):Promise<GoogleTokens>{
  let r:Response;
  try{r=await this.fetchImpl(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:this.config.clientId,client_secret:this.config.clientSecret,...params}),signal:AbortSignal.timeout(TIMEOUT_MS)})}
  catch{throw new OAuthError("network_error")}
  const d=await r.json().catch(()=>({})) as {access_token?:string;refresh_token?:string;expires_in?:number;scope?:string;error?:string};
  if(!r.ok||!d.access_token)throw new OAuthError(typeof d.error==="string"?d.error:`http_${r.status}`,r.status);
  return{accessToken:d.access_token,refreshToken:d.refresh_token??null,expiresAt:this.now().getTime()+(d.expires_in??3600)*1000,scope:d.scope??""};
 }

 exchangeCode(code:string,codeVerifier:string){return this.tokenRequest({grant_type:"authorization_code",code,code_verifier:codeVerifier,redirect_uri:this.config.redirectUri})}
 refresh(refreshToken:string){return this.tokenRequest({grant_type:"refresh_token",refresh_token:refreshToken})}

 /** Best effort: a token that is already invalid counts as revoked. */
 async revoke(token:string):Promise<boolean>{
  try{const r=await this.fetchImpl(REVOKE_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token}),signal:AbortSignal.timeout(TIMEOUT_MS)});return r.ok||r.status===400}catch{return false}
 }

 async identity(accessToken:string):Promise<GoogleIdentity>{
  let r:Response;
  try{r=await this.fetchImpl(USERINFO_URL,{headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(TIMEOUT_MS)})}catch{throw new OAuthError("network_error")}
  if(!r.ok)throw new OAuthError(`userinfo_http_${r.status}`,r.status);
  const d=await r.json() as {sub?:string;email?:string;email_verified?:boolean;name?:string};
  if(!d.sub||!d.email||d.email_verified===false)throw new OAuthError("unverified_identity");
  return{sub:d.sub,email:d.email.toLowerCase(),name:d.name??null};
 }
}

/** Every requested calendar scope must have been granted (users can untick boxes on the consent screen). */
export function missingScopes(granted:string,requested:string[]){const g=new Set(granted.split(/\s+/).filter(Boolean));return requested.filter(s=>s.startsWith(REQUIRED_CALENDAR_SCOPE_PREFIX)&&!g.has(s))}
