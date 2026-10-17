import Link from "next/link";
export default function HomePage(){return <main className="shell">
  <div className="brand"><span className="brand-mark"/>Intent Scheduler</div>
  <p className="eyebrow">One link for access, context and time.</p>
  <h1>Tell me what you need.</h1>
  <p className="lede">AI can understand the request, gather context and suggest the right next step. Or skip all of that and book a time directly.</p>
  <div className="card"><textarea className="intent-box" placeholder="I’d like to discuss…" aria-label="What do you need?"/>
    <div className="actions"><span className="subtle">Hosts connect Google Calendar. Visitors need no account.</span><div style={{display:"flex",gap:10}}><Link className="button primary" href="/dashboard">Set up your page</Link></div></div>
  </div>
  <section className="section"><div className="grid">
    <div className="feature"><strong>Direct booking</strong><p>Real availability remains usable even when AI is offline.</p></div>
    <div className="feature"><strong>Intent first</strong><p>One link can qualify, answer, route or recommend a meeting.</p></div>
    <div className="feature"><strong>Provider neutral</strong><p>Calendar and AI vendors sit behind replaceable adapters.</p></div>
  </div></section>
</main>}
