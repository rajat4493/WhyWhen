import "server-only";
import type {Pool} from "pg";
import type {AvailabilityPolicy,CalendarAccount,Host,HostContext,MeetingDuration,WeeklyRule} from "@/core/domain/types";
import type {HostDirectory} from "@/core/booking/store";
import type {CredentialStore,StoredCredential} from "../credentials";
import {decryptSecret,encryptSecret,randomToken} from "../crypto";
import type {GoogleIdentity,GoogleTokens} from "../oauth/google";
import {UNIQUE_VIOLATION,pgCode} from "./postgres";

type HostRow={id:string;slug:string;display_name:string;email:string|null;timezone:string;default_duration_minutes:number;weekly_availability:WeeklyRule[];buffer_before_minutes:number;buffer_after_minutes:number;minimum_notice_minutes:number;horizon_days:number;
 account_id:string|null;account_status:string|null;external_account_id:string|null;account_email:string|null;calendar_id:string|null};
const SELECT=`select h.id,h.slug,h.display_name,h.email,h.timezone,h.default_duration_minutes,h.weekly_availability,h.buffer_before_minutes,h.buffer_after_minutes,h.minimum_notice_minutes,h.horizon_days,
 a.id as account_id,a.status as account_status,a.external_account_id,a.email as account_email,a.calendar_id
 from hosts h left join integration_accounts a on a.host_id=h.id and a.kind='calendar' and a.provider='google'`;

function toContext(r:HostRow):HostContext{
 const policy:AvailabilityPolicy={timezone:r.timezone,weekly:r.weekly_availability,durationMinutes:r.default_duration_minutes as MeetingDuration,bufferBeforeMinutes:r.buffer_before_minutes,bufferAfterMinutes:r.buffer_after_minutes,minimumNoticeMinutes:r.minimum_notice_minutes,horizonDays:r.horizon_days};
 const host:Host={id:r.id,slug:r.slug,displayName:r.display_name,email:r.email??"",policy};
 const calendar:CalendarAccount|null=r.account_id&&r.account_status==="active"?{id:r.account_id,hostId:r.id,provider:"google",externalAccountId:r.external_account_id??"",email:r.account_email??"",timezone:r.timezone,credentialRef:r.account_id,calendarId:r.calendar_id??"primary"}:null;
 return{host,calendar};
}

const RESERVED_SLUGS=new Set(["api","dashboard","manage","demo","admin","login","logout","settings","_next"]);
export function slugBase(email:string){const s=email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,30);return s.length>=3&&!RESERVED_SLUGS.has(s)?s:`host-${s}`.replace(/-+$/,"").padEnd(3,"0")}

export type ConnectionStatus={accountId:string;status:"active"|"revoked";calendarId:string;email:string|null}|null;

/** Every method is keyed by a host id taken from the verified session or a public slug, never from client-supplied account ids. */
export class PostgresHostRepository implements HostDirectory,CredentialStore{
 constructor(private readonly pool:Pool,private readonly encryptionKey:Buffer){}

 async getBySlug(slug:string){const r=await this.pool.query<HostRow>(`${SELECT} where h.slug=$1`,[slug]);return r.rows[0]?toContext(r.rows[0]):null}
 async getById(hostId:string){const r=await this.pool.query<HostRow>(`${SELECT} where h.id=$1`,[hostId]);return r.rows[0]?toContext(r.rows[0]):null}

 /** Sign-in = connect: finds or creates the host for this Google identity. */
 async upsertGoogleHost(identity:GoogleIdentity):Promise<{hostId:string;created:boolean}>{
  const existing=await this.pool.query<{id:string}>("update hosts set email=$2,updated_at=now() where google_sub=$1 returning id",[identity.sub,identity.email]);
  if(existing.rows[0])return{hostId:existing.rows[0].id,created:false};
  const base=slugBase(identity.email);
  for(let attempt=0;attempt<6;attempt++){
   const slug=attempt===0?base:`${base.slice(0,30)}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,4)||"x"}`;
   try{const r=await this.pool.query<{id:string;created:boolean}>("insert into hosts (slug,display_name,email,google_sub) values ($1,$2,$3,$4) on conflict (google_sub) do update set email=excluded.email returning id,(xmax=0) as created",[slug,identity.name??identity.email.split("@")[0],identity.email,identity.sub]);return{hostId:r.rows[0].id,created:r.rows[0].created}}
   catch(err){if(pgCode(err)!==UNIQUE_VIOLATION)throw err}
  }
  throw new Error("Could not allocate a unique slug");
 }

 async saveGoogleConnection(hostId:string,input:{externalAccountId:string;email:string;tokens:GoogleTokens}){
  const r=await this.pool.query<{id:string}>(`insert into integration_accounts (host_id,kind,provider,external_account_id,email,calendar_id,encrypted_credentials,status)
   values ($1,'calendar','google',$2,$3,'primary',$4,'active')
   on conflict (host_id,kind,provider) do update set external_account_id=excluded.external_account_id,email=excluded.email,encrypted_credentials=excluded.encrypted_credentials,status='active',updated_at=now()
   returning id`,[hostId,input.externalAccountId,input.email,encryptSecret(JSON.stringify(input.tokens),this.encryptionKey,hostId)]);
  return r.rows[0].id;
 }

 async connection(hostId:string):Promise<ConnectionStatus>{
  const r=await this.pool.query<{id:string;status:"active"|"revoked";calendar_id:string|null;email:string|null}>("select id,status,calendar_id,email from integration_accounts where host_id=$1 and kind='calendar' and provider='google'",[hostId]);
  const a=r.rows[0];return a?{accountId:a.id,status:a.status,calendarId:a.calendar_id??"primary",email:a.email}:null;
 }

 async setTimezone(hostId:string,timezone:string){await this.pool.query("update hosts set timezone=$2,updated_at=now() where id=$1",[hostId,timezone])}

 async updateSettings(hostId:string,policy:AvailabilityPolicy,calendarId:string|null){
  await this.pool.query(`update hosts set timezone=$2,weekly_availability=$3::jsonb,default_duration_minutes=$4,buffer_before_minutes=$5,buffer_after_minutes=$6,minimum_notice_minutes=$7,horizon_days=$8,updated_at=now() where id=$1`,
   [hostId,policy.timezone,JSON.stringify(policy.weekly),policy.durationMinutes,policy.bufferBeforeMinutes,policy.bufferAfterMinutes,policy.minimumNoticeMinutes,policy.horizonDays]);
  if(calendarId)await this.pool.query("update integration_accounts set calendar_id=$2,updated_at=now() where host_id=$1 and kind='calendar' and provider='google'",[hostId,calendarId]);
 }

 /** Marks the connection revoked and wipes ciphertext. Returns the refresh token (if any) so the caller can revoke it at Google. */
 async disconnect(hostId:string):Promise<string|null>{
  const r=await this.pool.query<{id:string;encrypted_credentials:string|null}>("select id,encrypted_credentials from integration_accounts where host_id=$1 and kind='calendar' and provider='google'",[hostId]);
  const a=r.rows[0];if(!a)return null;
  let token:string|null=null;
  if(a.encrypted_credentials){try{const t=JSON.parse(decryptSecret(a.encrypted_credentials,this.encryptionKey,hostId)) as GoogleTokens;token=t.refreshToken??t.accessToken}catch{/* undecryptable: nothing to revoke */}}
  await this.markRevoked(a.id);
  return token;
 }

 // CredentialStore
 async load(accountId:string):Promise<StoredCredential|null>{
  const r=await this.pool.query<{id:string;host_id:string;status:"active"|"revoked";encrypted_credentials:string|null}>("select id,host_id,status,encrypted_credentials from integration_accounts where id=$1",[accountId]);
  const a=r.rows[0];if(!a)return null;
  return{accountId:a.id,hostId:a.host_id,status:a.status,tokens:a.encrypted_credentials?JSON.parse(decryptSecret(a.encrypted_credentials,this.encryptionKey,a.host_id)) as GoogleTokens:null};
 }
 async saveTokens(accountId:string,hostId:string,tokens:GoogleTokens){await this.pool.query("update integration_accounts set encrypted_credentials=$3,updated_at=now() where id=$1 and host_id=$2 and status='active'",[accountId,hostId,encryptSecret(JSON.stringify(tokens),this.encryptionKey,hostId)])}
 async markRevoked(accountId:string){await this.pool.query("update integration_accounts set status='revoked',encrypted_credentials=null,updated_at=now() where id=$1",[accountId])}
}
