import "server-only";
import {z} from "zod";
import {parseEncryptionKey} from "./crypto";
import {DEFAULT_GOOGLE_SCOPES} from "./oauth/google";

const schema=z.object({
 NEXT_PUBLIC_APP_URL:z.string().url(),
 DATABASE_URL:z.string().min(1),
 DATABASE_CA_CERT:z.string().optional(),
 APP_ENCRYPTION_KEY:z.string().min(1),
 SESSION_SECRET:z.string().min(32,"SESSION_SECRET must be at least 32 characters"),
 GOOGLE_CLIENT_ID:z.string().min(1),
 GOOGLE_CLIENT_SECRET:z.string().min(1),
 GOOGLE_REDIRECT_URI:z.string().url(),
 GOOGLE_OAUTH_SCOPES:z.string().optional(),
 BOOKING_HOLD_TTL_SECONDS:z.coerce.number().int().min(60).max(1800).default(600),
});

export type ServerEnv=ReturnType<typeof loadServerEnv>;

/** Validated lazily at request time (never at build). Errors name missing variables only, never values. */
export function loadServerEnv(source:Record<string,string|undefined>=process.env){
 // Empty `KEY=` lines in env files count as unset.
 const parsed=schema.safeParse(Object.fromEntries(Object.entries(source).filter(([,v])=>v!==undefined&&v.trim()!=="")));
 if(!parsed.success)throw new ConfigurationError(`Server configuration incomplete: ${[...new Set(parsed.error.issues.map(i=>String(i.path[0])))].join(", ")}`);
 const e=parsed.data;
 let encryptionKey:Buffer;try{encryptionKey=parseEncryptionKey(e.APP_ENCRYPTION_KEY)}catch(err){throw new ConfigurationError((err as Error).message)}
 return{...e,appUrl:e.NEXT_PUBLIC_APP_URL.replace(/\/$/,""),encryptionKey,googleScopes:e.GOOGLE_OAUTH_SCOPES?.split(/\s+/).filter(Boolean)??DEFAULT_GOOGLE_SCOPES};
}
export class ConfigurationError extends Error{constructor(message:string){super(message);this.name="ConfigurationError"}}
