import Link from "next/link";
import {IconBolt,IconCalendar,IconMessage,IconShield,Wordmark} from "@/app/components/icons";
export default function HomePage(){return <main className="page">
 <nav className="topbar"><Wordmark/><Link className="button ghost" href="/dashboard">Sign in</Link></nav>
 <section className="hero">
  <h1 className="display">Ask <em>why</em><br/>before <em>when</em>.</h1>
  <p className="lede">One link where people tell you what they need, or book a time directly. Fewer pointless meetings, and every time is re-checked against your calendar before it&apos;s booked.</p>
  <p className="section" style={{marginTop:28}}><Link className="button accent" href="/dashboard">Create your link</Link> <span className="subtle" style={{marginLeft:10}}>Works with Google Calendar</span></p>
 </section>
 <div className="card preview" aria-hidden="true">
  <div className="host"><span className="avatar sm">R</span><span className="host-name">Rajat</span></div>
  <p style={{fontFamily:"var(--serif)",fontSize:28,margin:"18px 0 8px",lineHeight:1.1}}>What do you <em style={{color:"var(--accent)"}}>need</em>?</p>
  <p className="subtle" style={{margin:0}}>I&apos;d like to review our pricing page before launch…</p>
  <div className="composer-foot"><span className="tiny">or book a time directly</span><span className="button primary" style={{minHeight:36}}>Continue</span></div>
 </div>
 <ul className="features">
  <li><IconMessage/><span><b>Intent first</b>People say what they need. Not everything needs a meeting.</span></li>
  <li><IconCalendar/><span><b>Real availability</b>Read live from your calendar. Visitors never see your events.</span></li>
  <li><IconShield/><span><b>Checked twice</b>Every time is re-checked against your calendar right before it&apos;s confirmed.</span></li>
  <li><IconBolt/><span><b>Booked in seconds</b>Pick a day, pick a time, add your name. Done.</span></li>
 </ul>
 <footer className="powered"><span className="tiny">WhyWhen</span></footer>
</main>}
