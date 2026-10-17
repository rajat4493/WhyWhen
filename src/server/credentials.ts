import "server-only";
import {CalendarProviderError,type CredentialResolver} from "@/core/integrations/calendar/adapter";
import {OAuthError,type GoogleOAuthClient,type GoogleTokens} from "./oauth/google";

export type StoredCredential={accountId:string;hostId:string;status:"active"|"revoked";tokens:GoogleTokens|null};
export interface CredentialStore{load(accountId:string):Promise<StoredCredential|null>;saveTokens(accountId:string,hostId:string,tokens:GoogleTokens):Promise<void>;markRevoked(accountId:string):Promise<void>}

const REFRESH_MARGIN_MS=60_000;

/** Resolves a usable access token for a calendar account; refreshes when (nearly) expired; detects revocation. */
export class GoogleCredentialResolver implements CredentialResolver{
 constructor(private readonly store:CredentialStore,private readonly oauth:GoogleOAuthClient,private readonly now:()=>Date=()=>new Date(),private readonly log?:(event:string,fields:Record<string,unknown>)=>void){}
 async accessToken(accountId:string):Promise<string>{
  const c=await this.store.load(accountId);
  if(!c||c.status!=="active"||!c.tokens)throw new CalendarProviderError("auth","google","Calendar connection is not active");
  if(c.tokens.expiresAt-REFRESH_MARGIN_MS>this.now().getTime())return c.tokens.accessToken;
  if(!c.tokens.refreshToken){await this.store.markRevoked(accountId);throw new CalendarProviderError("auth","google","No refresh token; reconnect required")}
  try{
   const fresh=await this.oauth.refresh(c.tokens.refreshToken);
   // Google usually omits refresh_token on refresh; keep the existing one.
   await this.store.saveTokens(accountId,c.hostId,{...fresh,refreshToken:fresh.refreshToken??c.tokens.refreshToken,scope:fresh.scope||c.tokens.scope});
   return fresh.accessToken;
  }catch(err){
   if(err instanceof OAuthError&&err.revoked){await this.store.markRevoked(accountId);this.log?.("oauth.revoked",{accountId});throw new CalendarProviderError("auth","google","Google access was revoked; reconnect required")}
   this.log?.("oauth.refresh_failed",{accountId,code:err instanceof OAuthError?err.code:"unknown"});
   throw new CalendarProviderError("unavailable","google","Google token refresh failed");
  }
 }
}
