import type {BookingDraft,CalendarAccount,TimeInterval} from "../../domain/types";
export type CreatedCalendarEvent={externalEventId:string;htmlUrl?:string;meetingUrl?:string;alreadyExisted?:boolean};
/** Identifies our event at the provider. Adapters that support client-chosen IDs derive one from `bookingId`. */
export type EventRef={bookingId:string;externalEventId?:string|null};
export type CalendarSummary={id:string;name:string;primary:boolean;timezone?:string;writable:boolean};
export interface CalendarAdapter{readonly provider:CalendarAccount["provider"];listCalendars(account:CalendarAccount):Promise<CalendarSummary[]>;getBusy(account:CalendarAccount,range:TimeInterval):Promise<TimeInterval[]>;
 /** Must be idempotent per `booking.bookingId`: a retry returns the existing event with `alreadyExisted`. */
 createEvent(account:CalendarAccount,booking:BookingDraft):Promise<CreatedCalendarEvent>;
 rescheduleEvent(account:CalendarAccount,ref:EventRef,slot:TimeInterval):Promise<CreatedCalendarEvent>;
 /** Treats an already-deleted/missing event as success. */
 cancelEvent(account:CalendarAccount,ref:EventRef):Promise<void>}
export interface CredentialResolver{accessToken(credentialRef:string):Promise<string>}

/**
 * auth: credentials rejected/revoked. not_found: calendar or event missing. rate_limited: provider throttled.
 * rejected: provider refused the request (validation/permission). unavailable: network/timeout/5xx — for writes
 * it is UNKNOWN whether the change was applied, so callers must reconcile instead of assuming failure.
 */
export type CalendarErrorKind="auth"|"not_found"|"rate_limited"|"rejected"|"unavailable";
export class CalendarProviderError extends Error{
 constructor(readonly kind:CalendarErrorKind,readonly provider:string,message:string,readonly status?:number){super(message);this.name="CalendarProviderError"}
 /** For writes: true when the provider certainly did not apply the change. */
 get definitelyNotApplied(){return this.kind!=="unavailable"}
}
