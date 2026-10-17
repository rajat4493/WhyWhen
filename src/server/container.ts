import "server-only";
import {randomUUID} from "node:crypto";
import {BookingService} from "@/core/booking/service";
import {GoogleCalendarAdapter} from "@/core/integrations/calendar/google";
import {GoogleCredentialResolver} from "./credentials";
import {manageToken} from "./crypto";
import {createPool} from "./db/postgres";
import {PostgresBookingStore} from "./db/booking-store";
import {PostgresHostRepository} from "./db/host-repository";
import {loadServerEnv} from "./env";
import {logEvent} from "./log";
import {GoogleOAuthClient} from "./oauth/google";

function build(){
 const env=loadServerEnv();
 const pool=createPool(env.DATABASE_URL,env.DATABASE_CA_CERT);
 const hosts=new PostgresHostRepository(pool,env.encryptionKey);
 const store=new PostgresBookingStore(pool);
 const oauth=new GoogleOAuthClient({clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,redirectUri:env.GOOGLE_REDIRECT_URI,scopes:env.googleScopes});
 const google=new GoogleCalendarAdapter(new GoogleCredentialResolver(hosts,oauth,()=>new Date(),logEvent));
 const bookings=new BookingService({store,hosts,now:()=>new Date(),newId:randomUUID,holdTtlSeconds:env.BOOKING_HOLD_TTL_SECONDS,log:logEvent,
  manageUrl:id=>`${env.appUrl}/manage/${manageToken(id,env.SESSION_SECRET)}`,
  calendars:provider=>{if(provider!=="google")throw new Error(`Calendar provider ${provider} is not enabled in M2`);return google}});
 return{env,pool,hosts,store,oauth,google,bookings};
}

let services:ReturnType<typeof build>|undefined;
/** One instance per server process (pool reuse across requests). */
export function getServices(){return services??=build()}
