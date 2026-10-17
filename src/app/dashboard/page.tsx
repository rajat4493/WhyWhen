export default function DashboardPage(){return <main className="shell">
 <div className="brand"><span className="brand-mark"/>Host settings</div><p className="eyebrow">Minimal control surface</p><h1>Your access policy.</h1>
 <p className="lede">Configure availability, AI behavior and connected services without turning the product into a CRM.</p>
 <section className="section stack">
  <div className="panel stack"><div className="row"><strong>Calendar</strong><span className="pill">Required</span></div><select className="field" defaultValue="google"><option value="google">Google Calendar</option><option value="microsoft">Microsoft / Outlook</option><option value="zoho">Zoho Calendar</option></select></div>
  <div className="panel stack"><div className="row"><strong>AI routing</strong><span className="pill">Optional for booking</span></div><select className="field" defaultValue="gateway"><option value="gateway">AI Gateway</option><option value="openai-compatible">OpenAI-compatible API</option><option value="mock">Mock / local</option></select><input className="field" placeholder="Model ID (configurable, not hard-coded)"/></div>
  <div className="panel stack"><strong>Meeting policy</strong><input className="field" defaultValue="30" aria-label="Default duration"/><input className="field" defaultValue="10:00–17:00" aria-label="Working hours"/><input className="field" defaultValue="15 min buffer" aria-label="Buffer"/></div>
 </section>
</main>}
