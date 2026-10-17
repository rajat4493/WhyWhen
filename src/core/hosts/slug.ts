// Public link slug: chosen once by the host at first setup (V0 has no later editing, history or redirects).
export const SLUG_MIN=3,SLUG_MAX=40;
const FORMAT=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Route segments and words that must never be a host's public path. */
export const RESERVED_SLUGS=new Set(["api","app","dashboard","manage","book","demo","admin","login","logout","signin","signup","settings","account","help","support","about","terms","privacy","www","static","assets","public","_next","favicon-ico","robots-txt","sitemap-xml","whywhen"]);

export function normalizeSlugInput(value:string){return value.trim().toLowerCase()}

/** Returns a visitor-facing problem, or null when the slug is acceptable (uniqueness is checked by the DB). */
export function slugProblem(slug:string):string|null{
 if(slug.length<SLUG_MIN||slug.length>SLUG_MAX)return`Use ${SLUG_MIN}–${SLUG_MAX} characters.`;
 if(!FORMAT.test(slug))return"Use lowercase letters, numbers and single hyphens, starting and ending with a letter or number.";
 if(RESERVED_SLUGS.has(slug))return"That link is reserved. Please choose another.";
 return null;
}

/** "Rajat Pandey" → "rajat-pandey"; diacritics folded; falls back to the email local-part, then "host". */
export function slugFromName(displayName:string|null,email:string):string{
 const clean=(v:string)=>v.normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,SLUG_MAX).replace(/-+$/,"");
 for(const candidate of [clean(displayName??""),clean(email.split("@")[0])])if(candidate&&!slugProblem(candidate))return candidate;
 const short=clean(displayName??"")||clean(email.split("@")[0]);
 return short&&!slugProblem(`${short}-host`)?`${short}-host`:"host";
}
