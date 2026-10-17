import type {BookingDraft,CalendarAccount,TimeInterval} from "../../domain/types";
export type CreatedCalendarEvent={externalEventId:string;htmlUrl?:string;meetingUrl?:string};
export interface CalendarAdapter{readonly provider:CalendarAccount["provider"];getBusy(account:CalendarAccount,range:TimeInterval):Promise<TimeInterval[]>;createEvent(account:CalendarAccount,booking:BookingDraft):Promise<CreatedCalendarEvent>;cancelEvent(account:CalendarAccount,externalEventId:string):Promise<void>}
export interface CredentialResolver{accessToken(credentialRef:string):Promise<string>}
