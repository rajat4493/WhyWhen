# Integrations
Provider docs were checked at bootstrap; re-check before implementation.

## Google Calendar
Free/busy: `POST https://www.googleapis.com/calendar/v3/freeBusy`.
Create event: `POST /calendar/v3/calendars/{calendarId}/events`.
Refs: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query and https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
Gmail is a separate optional mail capability.

## Microsoft / Outlook
Microsoft Graph free/busy: `POST /me/calendar/getSchedule`. Event creation: `POST /me/events`.
Ref: https://learn.microsoft.com/en-us/graph/api/calendar-getschedule?view=graph-rest-1.0
Outlook Mail can implement `MailAdapter` separately.

## Zoho
Free/busy: `/api/v1/calendars/freebusy`. Create: `/api/v1/calendars/{calendar_uid}/events`.
Refs: https://www.zoho.com/calendar/help/api/get-user-freebusy-details.html and https://www.zoho.com/calendar/help/api/post-create-event.html
Do not call Zoho supported until a live response fixture is normalized and create/cancel is proven.

## MCP
Two directions: expose scheduling tools; consume approved remote MCP tools. Bootstrap research found stable MCP TypeScript v2 packages `@modelcontextprotocol/server` and `@modelcontextprotocol/client`; re-verify before install.

## Credential rules
Encrypt refresh tokens/API keys; browser gets status not secrets; re-consent on scope expansion; calendar/mail permissions separate; support revoke/disconnect.
