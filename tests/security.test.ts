import {describe,expect,it} from "vitest";
import {randomBytes} from "node:crypto";
import {decryptSecret,encryptSecret,manageToken,parseEncryptionKey,verifyManageToken} from "../src/server/crypto";
import {createSession,readSession} from "../src/server/session";
import {FixedWindowRateLimiter} from "../src/server/rate-limit";
import {redact} from "../src/server/log";
import {confirmRequest} from "../src/server/validation";

const key=randomBytes(32);const SECRET="s".repeat(40);const now=new Date("2026-10-19T08:00:00Z");
describe("token encryption at rest",()=>{
 it("round-trips and never stores plaintext",()=>{const c=encryptSecret('{"refreshToken":"rt-secret"}',key,"host-1");expect(c).not.toContain("rt-secret");expect(decryptSecret(c,key,"host-1")).toBe('{"refreshToken":"rt-secret"}')});
 it("ciphertext moved to another host's row fails to decrypt (AAD binding)",()=>{expect(()=>decryptSecret(encryptSecret("x",key,"host-1"),key,"host-2")).toThrow()});
 it("tampered ciphertext or wrong key fails",()=>{const c=encryptSecret("x",key,"h");expect(()=>decryptSecret(c.slice(0,-2)+"AA",key,"h")).toThrow();expect(()=>decryptSecret(c,randomBytes(32),"h")).toThrow()});
 it("requires a 32-byte key",()=>{expect(()=>parseEncryptionKey("short")).toThrow(/32 random bytes/);expect(parseEncryptionKey(key.toString("base64"))).toHaveLength(32)});
});
describe("sessions and management links",()=>{
 it("session cookie verifies, expires, and resists tampering",()=>{
  const s=createSession("host-1",SECRET,now);
  expect(readSession(s,SECRET,now)).toBe("host-1");
  expect(readSession(s,SECRET,new Date(now.getTime()+8*86_400_000))).toBeNull();
  expect(readSession(s,"y".repeat(40),now)).toBeNull();
  const [p,sig]=s.split(".");const forged=Buffer.from(JSON.stringify({hostId:"host-2",exp:now.getTime()+1e9})).toString("base64url");
  expect(readSession(`${forged}.${sig}`,SECRET,now)).toBeNull();expect(p).not.toBe(forged);
 });
 it("manage token is bound to one booking",()=>{
  const id="3f2b8c1e-9a4d-4c6e-8b1f-0a2b3c4d5e6f";const t=manageToken(id,SECRET);
  expect(verifyManageToken(t,SECRET)).toBe(id);
  expect(verifyManageToken(t.replace("3f2b","3f2c"),SECRET)).toBeNull();
  expect(verifyManageToken(`${id}.forged`,SECRET)).toBeNull();
 });
});
describe("abuse boundaries",()=>{
 it("rate limiter blocks after the limit and resets per window",()=>{
  const l=new FixedWindowRateLimiter(2,60_000);
  expect(l.check("ip",0).allowed).toBe(true);expect(l.check("ip",1).allowed).toBe(true);
  const b=l.check("ip",2);expect(b.allowed).toBe(false);expect(b.retryAfterSeconds).toBe(60);
  expect(l.check("other",3).allowed).toBe(true);expect(l.check("ip",60_001).allowed).toBe(true);
 });
 it("public booking input is validated",()=>{
  const base={holdId:"3f2b8c1e-9a4d-4c6e-8b1f-0a2b3c4d5e6f",idempotencyKey:"abcdefghijklmnop",name:"Ada",email:"ADA@Example.com",timezone:"Europe/Warsaw"};
  expect(confirmRequest.parse(base).email).toBe("ada@example.com");
  for(const bad of [{name:""},{name:"x\ny"},{name:"<script>"},{email:"nope"},{timezone:"Mars/Base"},{idempotencyKey:"short"},{holdId:"1"},{notes:"x".repeat(1001)}])expect(confirmRequest.safeParse({...base,...bad}).success).toBe(false);
 });
 it("logs redact secrets",()=>{expect(redact({accessToken:"a",refresh_token:"b",bookingId:"c",nested:{authorization:"d"}})).toEqual({accessToken:"[redacted]",refresh_token:"[redacted]",bookingId:"c",nested:{authorization:"[redacted]"}})});
});
