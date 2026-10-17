import Link from "next/link";
export default async function PublicIntentPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params; const displayName=slug==="demo"?"Rajat":slug;
 return <main className="shell">
  <div className="brand"><span className="brand-mark"/>{displayName}</div>
  <p className="eyebrow">What would you like to do with {displayName}?</p>
  <h1>Start with the outcome.</h1>
  <p className="lede">Describe what you need in your own words. The assistant can collect context and suggest the shortest path — including no meeting at all.</p>
  <form className="card" action="/api/intent" method="post"><input type="hidden" name="slug" value={slug}/><textarea className="intent-box" name="intent" placeholder={`I’d like ${displayName} to…`} required/><div className="actions"><Link className="button" href={`/${slug}/book`}>Book a time</Link><button className="button primary" type="submit">Continue</button></div></form>
 </main>
}
