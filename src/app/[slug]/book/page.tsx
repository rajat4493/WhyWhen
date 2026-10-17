const demoSlots=["09:30","10:15","11:30","13:00","14:30","16:00"];
export default async function BookingPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <main className="shell">
 <div className="brand"><span className="brand-mark"/>{slug}</div><p className="eyebrow">Direct booking</p><h1>Choose a time.</h1>
 <p className="lede">Demo slots are shown until a calendar account is connected. Production availability is read live from the selected provider.</p>
 <section className="section panel stack"><div className="row"><strong>30 minutes</strong><span className="pill">Europe/Warsaw</span></div><div className="slot-grid">{demoSlots.map(slot=><button className="slot" key={slot}>{slot}</button>)}</div></section>
</main>}
