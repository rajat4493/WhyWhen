export type MailProvider="gmail"|"outlook"|"zoho";
export type MailThreadSummary={id:string;subject:string;participants:string[];snippet:string};
export interface MailAdapter{readonly provider:MailProvider;search(query:string,limit?:number):Promise<MailThreadSummary[]>;readThread(id:string):Promise<unknown>;send(input:{to:string[];subject:string;bodyText:string}):Promise<{id:string}>}
// Mail is optional to direct booking. Add concrete adapters only for a proven flow.
