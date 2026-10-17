import "server-only";
import {Pool,type PoolClient} from "pg";

/**
 * DATABASE_URL: Supabase → Project Settings → Database → connection string (use the transaction pooler, port 6543,
 * for serverless). TLS is verified when DATABASE_CA_CERT (PEM) is set; local hosts connect without TLS.
 */
export function createPool(url:string,caCert?:string){
 const host=new URL(url).hostname;const local=host==="localhost"||host==="127.0.0.1";
 const ssl=local?undefined:caCert?{ca:caCert,rejectUnauthorized:true}:{rejectUnauthorized:false};
 return new Pool({connectionString:url.replace(/[?&]sslmode=[^&]*/,""),ssl,max:Number(process.env.DATABASE_POOL_MAX??5),idleTimeoutMillis:10_000,connectionTimeoutMillis:10_000});
}

/** Runs `fn` in a transaction; re-runs it on deadlock/serialization failure (the whole unit is retried, so `fn` must only touch the DB). */
export async function inTransaction<T>(pool:Pool,fn:(client:PoolClient)=>Promise<T>,attempts=3):Promise<T>{
 for(let attempt=1;;attempt++){
  const client=await pool.connect();
  try{await client.query("begin");const result=await fn(client);await client.query("commit");return result}
  catch(err){
   await client.query("rollback").catch(()=>undefined);
   if(attempt<attempts&&RETRYABLE.has(pgCode(err)??""))continue;
   throw err;
  }
  finally{client.release()}
 }
}

/**
 * Serializes slot-claiming writes for one host. Concurrent inserts checked by an exclusion constraint can otherwise
 * wait on each other's uncommitted rows and deadlock (observed: 40P01 in the 10-visitor race test).
 */
export async function lockHost(client:PoolClient,hostId:string){await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[`host-slots:${hostId}`])}

export const pgCode=(err:unknown)=>typeof err==="object"&&err!==null&&"code" in err?String((err as {code:unknown}).code):undefined;
export const EXCLUSION_VIOLATION="23P01",UNIQUE_VIOLATION="23505";
const RETRYABLE=new Set(["40P01","40001"]);
