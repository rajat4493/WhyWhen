import "server-only";

const SENSITIVE=/token|secret|password|authorization|cookie|code|key|credential/i;

/** Structured log line. Values under sensitive-looking keys are redacted; never pass raw provider responses here. */
export function redact(fields:Record<string,unknown>):Record<string,unknown>{
 return Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,SENSITIVE.test(k)?"[redacted]":v&&typeof v==="object"&&!Array.isArray(v)?redact(v as Record<string,unknown>):v]));
}
export function logEvent(event:string,fields:Record<string,unknown>={}){console.info(JSON.stringify({at:new Date().toISOString(),event,...redact(fields)}))}
