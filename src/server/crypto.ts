import "server-only";
import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from "node:crypto";

const b64url=(b:Buffer)=>b.toString("base64url");

/** APP_ENCRYPTION_KEY: base64 (or base64url) encoding of exactly 32 random bytes. */
export function parseEncryptionKey(value:string|undefined):Buffer{
 const key=Buffer.from((value??"").trim(),"base64");
 if(key.length!==32)throw new Error("APP_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (e.g. `openssl rand -base64 32`)");
 return key;
}

/** AES-256-GCM. `aad` binds the ciphertext to its owner so it cannot be swapped onto another host's row. */
export function encryptSecret(plaintext:string,key:Buffer,aad:string):string{
 const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(Buffer.from(aad));
 const ct=Buffer.concat([cipher.update(plaintext,"utf8"),cipher.final()]);
 return["v1",b64url(iv),b64url(cipher.getAuthTag()),b64url(ct)].join(".");
}
export function decryptSecret(payload:string,key:Buffer,aad:string):string{
 const [v,iv,tag,ct]=payload.split(".");if(v!=="v1"||!iv||!tag||ct===undefined)throw new Error("Unsupported ciphertext format");
 const d=createDecipheriv("aes-256-gcm",key,Buffer.from(iv,"base64url"));d.setAAD(Buffer.from(aad));d.setAuthTag(Buffer.from(tag,"base64url"));
 return Buffer.concat([d.update(Buffer.from(ct,"base64url")),d.final()]).toString("utf8");
}

const mac=(secret:string,purpose:string,data:string)=>createHmac("sha256",secret).update(`${purpose}\n${data}`).digest();
const safeEqual=(a:Buffer,b:Buffer)=>a.length===b.length&&timingSafeEqual(a,b);

/** `payload.signature`, purpose-scoped so a value signed for one use can't be replayed as another. */
export function sign(payload:string,secret:string,purpose:string){const p=b64url(Buffer.from(payload));return`${p}.${b64url(mac(secret,purpose,p))}`}
export function verifySigned(value:string|undefined,secret:string,purpose:string):string|null{
 if(!value)return null;const i=value.lastIndexOf(".");if(i<=0)return null;
 const p=value.slice(0,i),sig=Buffer.from(value.slice(i+1),"base64url");
 return safeEqual(sig,mac(secret,purpose,p))?Buffer.from(p,"base64url").toString("utf8"):null;
}

export const randomToken=(bytes=32)=>b64url(randomBytes(bytes));
export const sha256b64url=(value:string)=>b64url(createHash("sha256").update(value).digest());
export function constantTimeEqual(a:string,b:string){return safeEqual(Buffer.from(a),Buffer.from(b))}

/** Booking management capability: `<bookingId>.<hmac>`. Deterministic, so duplicate responses can return the same link. */
export function manageToken(bookingId:string,secret:string){return`${bookingId}.${b64url(mac(secret,"manage-booking",bookingId))}`}
export function verifyManageToken(token:string,secret:string):string|null{
 const i=token.indexOf(".");if(i<=0)return null;const id=token.slice(0,i);
 return /^[0-9a-f-]{36}$/.test(id)&&constantTimeEqual(token,manageToken(id,secret))?id:null;
}
