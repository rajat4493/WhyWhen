import {describe,expect,it,vi} from "vitest";
import {GoogleCredentialResolver,type CredentialStore,type StoredCredential} from "../src/server/credentials";
import {GoogleOAuthClient,OAuthError,missingScopes,DEFAULT_GOOGLE_SCOPES} from "../src/server/oauth/google";
import {createOAuthState,verifyOAuthState} from "../src/server/session";
import {sign} from "../src/server/crypto";

const SECRET="s".repeat(40);const now=new Date("2026-10-19T08:00:00Z");
const config={clientId:"cid",clientSecret:"csecret",redirectUri:"http://localhost:3000/api/oauth/google/callback",scopes:DEFAULT_GOOGLE_SCOPES};

describe("OAuth state + PKCE",()=>{
 it("builds an authorization URL with state, S256 PKCE, offline access and consent",()=>{
  const s=createOAuthState(SECRET,now);
  const u=new URL(new GoogleOAuthClient(config).authorizationUrl({state:s.state,codeChallenge:s.codeChallenge}));
  expect(Object.fromEntries(u.searchParams)).toMatchObject({state:s.state,code_challenge:s.codeChallenge,code_challenge_method:"S256",access_type:"offline",prompt:"consent",response_type:"code"});
  expect(u.searchParams.get("scope")).toContain("calendar.events.owned");
  expect(u.toString()).not.toContain("csecret");
 });
 it("accepts the matching state and returns the verifier",()=>{const s=createOAuthState(SECRET,now);expect(verifyOAuthState(s.cookie,s.state,SECRET,now)).toEqual({ok:true,verifier:s.verifier})});
 it("rejects a mismatched state (CSRF)",()=>{const s=createOAuthState(SECRET,now);expect(verifyOAuthState(s.cookie,"attacker-state",SECRET,now)).toEqual({ok:false,reason:"mismatch"})});
 it("rejects missing cookie or parameter",()=>{const s=createOAuthState(SECRET,now);expect(verifyOAuthState(undefined,s.state,SECRET,now).ok).toBe(false);expect(verifyOAuthState(s.cookie,null,SECRET,now).ok).toBe(false)});
 it("rejects a tampered or foreign-signed cookie",()=>{
  const s=createOAuthState(SECRET,now);
  expect(verifyOAuthState(s.cookie.replace(/.$/,c=>c==="A"?"B":"A"),s.state,SECRET,now)).toEqual({ok:false,reason:"tampered"});
  expect(verifyOAuthState(createOAuthState("x".repeat(40),now).cookie,s.state,SECRET,now)).toEqual({ok:false,reason:"tampered"});
  // A value signed for another purpose (e.g. a session) is not a valid OAuth state.
  expect(verifyOAuthState(sign(JSON.stringify({state:s.state,verifier:"v",exp:now.getTime()+1e6}),SECRET,"session"),s.state,SECRET,now)).toEqual({ok:false,reason:"tampered"});
 });
 it("rejects an expired state",()=>{const s=createOAuthState(SECRET,now);expect(verifyOAuthState(s.cookie,s.state,SECRET,new Date(now.getTime()+11*60_000))).toEqual({ok:false,reason:"expired"})});
 it("detects calendar scopes the user unticked",()=>{
  expect(missingScopes(DEFAULT_GOOGLE_SCOPES.join(" "),DEFAULT_GOOGLE_SCOPES)).toEqual([]);
  expect(missingScopes("openid email https://www.googleapis.com/auth/calendar.freebusy",DEFAULT_GOOGLE_SCOPES)).toEqual(["https://www.googleapis.com/auth/calendar.calendarlist.readonly","https://www.googleapis.com/auth/calendar.events.owned"]);
 });
});

describe("token exchange / refresh / revoke",()=>{
 const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status});
 it("exchanges the code with the PKCE verifier",async()=>{
  const f=vi.fn(async()=>json(200,{access_token:"at",refresh_token:"rt",expires_in:3600,scope:"s"}));
  const t=await new GoogleOAuthClient(config,f as unknown as typeof fetch,()=>now).exchangeCode("the-code","the-verifier");
  expect(t).toEqual({accessToken:"at",refreshToken:"rt",expiresAt:now.getTime()+3_600_000,scope:"s"});
  const body=new URLSearchParams(String((f.mock.calls[0] as unknown[])[1] && ((f.mock.calls[0] as unknown[])[1] as RequestInit).body));
  expect(body.get("code_verifier")).toBe("the-verifier");expect(body.get("grant_type")).toBe("authorization_code");
 });
 it("surfaces invalid_grant as revoked",async()=>{
  const f=async()=>json(400,{error:"invalid_grant",error_description:"Token has been expired or revoked."});
  const err=await new GoogleOAuthClient(config,f as unknown as typeof fetch).refresh("rt").catch(e=>e);
  expect(err).toBeInstanceOf(OAuthError);expect(err.revoked).toBe(true);expect(err.message).not.toContain("rt");
 });
});

class MemCreds implements CredentialStore{
 constructor(public c:StoredCredential|null){}
 saved:StoredCredential["tokens"][]=[];revoked=false;
 async load(){return this.c}
 async saveTokens(_id:string,_h:string,t:NonNullable<StoredCredential["tokens"]>){this.saved.push(t);if(this.c)this.c={...this.c,tokens:t}}
 async markRevoked(){this.revoked=true;if(this.c)this.c={...this.c,status:"revoked",tokens:null}}
}
const cred=(expiresAt:number):StoredCredential=>({accountId:"a1",hostId:"h1",status:"active",tokens:{accessToken:"old-at",refreshToken:"rt",expiresAt,scope:"s"}});

describe("GoogleCredentialResolver",()=>{
 it("uses a valid access token without refreshing",async()=>{
  const oauth={refresh:vi.fn()} as unknown as GoogleOAuthClient;
  expect(await new GoogleCredentialResolver(new MemCreds(cred(now.getTime()+30*60_000)),oauth,()=>now).accessToken("a1")).toBe("old-at");
  expect(oauth.refresh).not.toHaveBeenCalled();
 });
 it("refreshes an expired token, persists it and keeps the existing refresh token",async()=>{
  const store=new MemCreds(cred(now.getTime()-1000));
  const oauth={refresh:vi.fn(async()=>({accessToken:"new-at",refreshToken:null,expiresAt:now.getTime()+3_600_000,scope:""}))} as unknown as GoogleOAuthClient;
  expect(await new GoogleCredentialResolver(store,oauth,()=>now).accessToken("a1")).toBe("new-at");
  expect(store.saved[0]).toMatchObject({accessToken:"new-at",refreshToken:"rt",scope:"s"});
 });
 it("refreshes slightly before expiry",async()=>{
  const oauth={refresh:vi.fn(async()=>({accessToken:"new-at",refreshToken:null,expiresAt:0,scope:""}))} as unknown as GoogleOAuthClient;
  await new GoogleCredentialResolver(new MemCreds(cred(now.getTime()+30_000)),oauth,()=>now).accessToken("a1");
  expect(oauth.refresh).toHaveBeenCalledOnce();
 });
 it("revoked refresh token → connection marked revoked, auth error",async()=>{
  const store=new MemCreds(cred(0));
  const oauth={refresh:vi.fn(async()=>{throw new OAuthError("invalid_grant",400)})} as unknown as GoogleOAuthClient;
  await expect(new GoogleCredentialResolver(store,oauth,()=>now).accessToken("a1")).rejects.toMatchObject({kind:"auth"});
  expect(store.revoked).toBe(true);
 });
 it("transient refresh failure → unavailable, connection kept",async()=>{
  const store=new MemCreds(cred(0));
  const oauth={refresh:vi.fn(async()=>{throw new OAuthError("network_error")})} as unknown as GoogleOAuthClient;
  await expect(new GoogleCredentialResolver(store,oauth,()=>now).accessToken("a1")).rejects.toMatchObject({kind:"unavailable"});
  expect(store.revoked).toBe(false);
 });
 it("inactive connection → auth error without calling Google",async()=>{
  const oauth={refresh:vi.fn()} as unknown as GoogleOAuthClient;
  await expect(new GoogleCredentialResolver(new MemCreds({...cred(0),status:"revoked",tokens:null}),oauth).accessToken("a1")).rejects.toMatchObject({kind:"auth"});
  expect(oauth.refresh).not.toHaveBeenCalled();
 });
});
