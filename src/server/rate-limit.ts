import "server-only";

/**
 * Fixed-window limiter. BOUNDARY, not a guarantee: state is per server instance, so on serverless the effective limit
 * is per-instance. Swap for a shared store (Postgres/Redis/edge) before open launch (M6).
 */
export class FixedWindowRateLimiter{
 private readonly hits=new Map<string,{count:number;resetAt:number}>();
 constructor(readonly limit:number,readonly windowMs:number,private readonly maxKeys=10_000){}
 check(key:string,now=Date.now()):{allowed:boolean;retryAfterSeconds:number}{
  let e=this.hits.get(key);
  if(!e||e.resetAt<=now){
   if(this.hits.size>=this.maxKeys)for(const [k,v] of this.hits)if(v.resetAt<=now)this.hits.delete(k);
   if(this.hits.size>=this.maxKeys)this.hits.delete(this.hits.keys().next().value!);
   e={count:0,resetAt:now+this.windowMs};this.hits.set(key,e);
  }
  e.count++;
  return{allowed:e.count<=this.limit,retryAfterSeconds:Math.max(1,Math.ceil((e.resetAt-now)/1000))};
 }
}

const MINUTE=60_000;
export const limiters={
 availability:new FixedWindowRateLimiter(60,MINUTE),
 hold:new FixedWindowRateLimiter(12,MINUTE),
 booking:new FixedWindowRateLimiter(10,MINUTE),
 manage:new FixedWindowRateLimiter(20,MINUTE),
 oauth:new FixedWindowRateLimiter(10,MINUTE),
};
