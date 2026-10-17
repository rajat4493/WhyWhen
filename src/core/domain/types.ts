export type IsoDateTime=string;
export type TimeInterval={start:IsoDateTime;end:IsoDateTime};
export type CalendarProvider="google"|"microsoft"|"zoho";
export type CalendarAccount={id:string;hostId:string;provider:CalendarProvider;externalAccountId:string;email:string;timezone:string;credentialRef:string;calendarId?:string};
export type BookingDraft={bookingId:string;hostId:string;visitorName:string;visitorEmail:string;title:string;start:IsoDateTime;end:IsoDateTime;timezone:string;notes?:string;manageUrl?:string;idempotencyKey:string};
export type IntentDecision={needsMeeting:boolean;suggestedDurationMinutes:15|30|45|60;summary:string;clarificationQuestions:string[];confidence:number};

/** ISO weekday: Monday=1 … Sunday=7. */
export type Weekday=1|2|3|4|5|6|7;
/** Host-local wall-clock window, "HH:MM" 24h; end may be "24:00". */
export type WeeklyRule={weekday:Weekday;start:string;end:string};
export type MeetingDuration=15|30|45|60;
export type AvailabilityPolicy={timezone:string;weekly:WeeklyRule[];durationMinutes:MeetingDuration;bufferBeforeMinutes:number;bufferAfterMinutes:number;minimumNoticeMinutes:number;horizonDays:number};
/** `slug` is null until the host chooses their public link at first setup. */
export type Host={id:string;slug:string|null;displayName:string;email:string;policy:AvailabilityPolicy};
export type HostContext={host:Host;calendar:CalendarAccount|null};

/**
 * One row per hold/booking lifecycle:
 * held → pending_event → confirmed; pending_event → needs_reconciliation | failed; confirmed → cancelled.
 * held → expired | released | consumed (a reschedule hold merged into its booking).
 */
export type BookingStatus="held"|"pending_event"|"confirmed"|"needs_reconciliation"|"failed"|"cancelled"|"expired"|"released"|"consumed";
/** Statuses that occupy the host's time. Must match the DB exclusion constraint. */
export const SLOT_OCCUPYING_STATUSES:readonly BookingStatus[]=["held","pending_event","confirmed","needs_reconciliation"];
export type BookingRecord={id:string;hostId:string;provider:CalendarProvider;status:BookingStatus;start:IsoDateTime;end:IsoDateTime;holdExpiresAt:IsoDateTime|null;visitorName:string|null;visitorEmail:string|null;visitorTimezone:string|null;notes:string|null;title:string|null;idempotencyKey:string|null;externalEventId:string|null;externalEventUrl:string|null;failureReason:string|null;createdAt:IsoDateTime;updatedAt:IsoDateTime};
