import {describe,expect,it} from "vitest";
import {randomBytes} from "node:crypto";
import {ConfigurationError,loadServerEnv} from "../src/server/env";
import {DEFAULT_GOOGLE_SCOPES} from "../src/server/oauth/google";

const full={NEXT_PUBLIC_APP_URL:"http://localhost:3000/",DATABASE_URL:"postgres://u:p@localhost/db",APP_ENCRYPTION_KEY:randomBytes(32).toString("base64"),SESSION_SECRET:"s".repeat(40),GOOGLE_CLIENT_ID:"id",GOOGLE_CLIENT_SECRET:"secret",GOOGLE_REDIRECT_URI:"http://localhost:3000/api/oauth/google/callback"};
describe("server env",()=>{
 it("applies defaults and treats empty values as unset",()=>{
  const e=loadServerEnv({...full,GOOGLE_OAUTH_SCOPES:"",BOOKING_HOLD_TTL_SECONDS:"",DATABASE_CA_CERT:""});
  expect(e.googleScopes).toEqual(DEFAULT_GOOGLE_SCOPES);expect(e.BOOKING_HOLD_TTL_SECONDS).toBe(600);expect(e.appUrl).toBe("http://localhost:3000");
 });
 it("honours a scope override",()=>{expect(loadServerEnv({...full,GOOGLE_OAUTH_SCOPES:"openid  https://www.googleapis.com/auth/calendar"}).googleScopes).toEqual(["openid","https://www.googleapis.com/auth/calendar"])});
 it("names missing variables without echoing values",()=>{
  const err=(()=>{try{loadServerEnv({...full,GOOGLE_CLIENT_SECRET:"",SESSION_SECRET:"short-secret-value"})}catch(e){return e as Error}})();
  expect(err).toBeInstanceOf(ConfigurationError);expect(err!.message).toContain("GOOGLE_CLIENT_SECRET");expect(err!.message).toContain("SESSION_SECRET");expect(err!.message).not.toContain("short-secret-value");
 });
 it("rejects a weak encryption key as a configuration error",()=>{expect(()=>loadServerEnv({...full,APP_ENCRYPTION_KEY:"abc"})).toThrow(ConfigurationError);expect(()=>loadServerEnv({...full,APP_ENCRYPTION_KEY:"abc"})).toThrow(/32 random bytes/)});
});
