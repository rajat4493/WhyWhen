export type IsoDateTime=string;
export type TimeInterval={start:IsoDateTime;end:IsoDateTime};
export type CalendarProvider="google"|"microsoft"|"zoho";
export type CalendarAccount={id:string;hostId:string;provider:CalendarProvider;externalAccountId:string;email:string;timezone:string;credentialRef:string;calendarId?:string};
export type BookingDraft={hostId:string;visitorName:string;visitorEmail:string;title:string;start:IsoDateTime;end:IsoDateTime;timezone:string;notes?:string;idempotencyKey:string};
export type IntentDecision={needsMeeting:boolean;suggestedDurationMinutes:15|30|45|60;summary:string;clarificationQuestions:string[];confidence:number};
