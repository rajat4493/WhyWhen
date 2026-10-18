// Minimal inline icon set (no icon library: keeps the public page light). 20px, 1.75 stroke, currentColor.
type P={size?:number;className?:string};
const Svg=({size=20,className,children}:P&{children:React.ReactNode})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{children}</svg>;
export const IconCalendar=(p:P)=><Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></Svg>;
export const IconClock=(p:P)=><Svg {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></Svg>;
export const IconGlobe=(p:P)=><Svg {...p}><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/></Svg>;
export const IconArrowLeft=(p:P)=><Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6"/></Svg>;
export const IconArrowRight=(p:P)=><Svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Svg>;
export const IconChevronLeft=(p:P)=><Svg {...p}><path d="M15 6l-6 6 6 6"/></Svg>;
export const IconChevronRight=(p:P)=><Svg {...p}><path d="M9 6l6 6-6 6"/></Svg>;
export const IconCheck=(p:P)=><Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5"/></Svg>;
export const IconMessage=(p:P)=><Svg {...p}><path d="M5 18.5V7a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 7v6.5A2.5 2.5 0 0 1 16.5 16H9l-4 2.5z"/></Svg>;
export const IconShield=(p:P)=><Svg {...p}><path d="M12 3.5l7 3v5.5c0 4-3 7.2-7 8.5-4-1.3-7-4.5-7-8.5V6.5z"/><path d="M9 12l2 2 4-4"/></Svg>;
export const IconBolt=(p:P)=><Svg {...p}><path d="M13 3.5L5.5 13H12l-1 7.5L18.5 11H12z"/></Svg>;

/** Initials monogram: identity without collecting a photo. */
export function Avatar({name,size}:{name:string;size?:"sm"|"lg"}){
 const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]!.toUpperCase()).join("")||"·";
 return <span className={`avatar${size?` ${size}`:""}`} aria-hidden="true">{initials}</span>;
}

export function Wordmark(){return <span className="wordmark"><span className="logo-dot"/><span>Why<i>When</i></span></span>}
