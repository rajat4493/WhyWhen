import type {BookingRecord,BookingStatus,CalendarProvider,HostContext,TimeInterval} from "../domain/types";

export type CreateHoldInput={id:string;hostId:string;provider:CalendarProvider;calendarAccountId?:string;start:string;end:string;expiresAt:Date;now:Date};
export type HoldResult={ok:true;hold:BookingRecord}|{ok:false;reason:"slot_taken"};
export type ConvertHoldInput={holdId:string;now:Date;visitorName:string;visitorEmail:string;visitorTimezone:string;notes:string|null;title:string;idempotencyKey:string};
export type ConvertResult={ok:true;booking:BookingRecord}|{ok:false;reason:"hold_not_found"|"hold_expired"|"idempotency_conflict"};
export type TransitionPatch={status:BookingStatus;now:Date;externalEventId?:string|null;externalEventUrl?:string|null;failureReason?:string|null};
export type MoveResult={ok:true;booking:BookingRecord}|{ok:false;reason:"hold_not_found"|"hold_expired"|"slot_taken"|"booking_not_found"};

/**
 * Persistence port for holds and bookings. Implementations MUST make createHold, convertHold and moveToHold atomic
 * and MUST reject overlapping slot-occupying rows for one host (Postgres: exclusion constraint).
 */
export interface BookingStore{
 /** Occupied intervals: unexpired holds plus pending/confirmed/needs_reconciliation bookings. */
 occupiedIntervals(hostId:string,range:TimeInterval,now:Date,excludeIds?:string[]):Promise<TimeInterval[]>;
 /** Expires the host's stale holds, then inserts a hold; `slot_taken` when it would overlap an occupying row. */
 createHold(input:CreateHoldInput):Promise<HoldResult>;
 releaseHold(holdId:string,now:Date):Promise<void>;
 get(id:string):Promise<BookingRecord|null>;
 findByIdempotencyKey(hostId:string,key:string):Promise<BookingRecord|null>;
 /** Atomically turns an unexpired hold into a pending_event booking. */
 convertHold(input:ConvertHoldInput):Promise<ConvertResult>;
 /** Guarded status change: applies only when the current status is in `from`. Returns null otherwise. */
 transition(id:string,from:readonly BookingStatus[],patch:TransitionPatch):Promise<BookingRecord|null>;
 /** Atomically consumes the hold and moves the booking onto the hold's slot (reschedule). */
 moveToHold(bookingId:string,holdId:string,now:Date):Promise<MoveResult>;
 listForHost(hostId:string,from:Date,limit:number):Promise<BookingRecord[]>;
}

export interface HostDirectory{getBySlug(slug:string):Promise<HostContext|null>;getById(hostId:string):Promise<HostContext|null>}
