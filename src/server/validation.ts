import "server-only";
import {z} from "zod";
import {isValidTimeZone} from "@/core/availability/timezone";

// Public input boundary. Everything a visitor sends is validated here before reaching the booking service.
export const slugSchema=z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/,"Invalid link");
export const isoSchema=z.string().datetime({offset:true,message:"Invalid date/time"});
export const uuidSchema=z.string().uuid("Invalid id");
const plainText=(max:number)=>z.string().trim().max(max).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]*$/,"Contains unsupported characters");
export const timezoneSchema=z.string().refine(isValidTimeZone,"Unknown timezone");

export const availabilityQuery=z.object({start:isoSchema,end:isoSchema});
export const holdRequest=z.object({slug:slugSchema,start:isoSchema});
export const confirmRequest=z.object({
 holdId:uuidSchema,
 idempotencyKey:z.string().regex(/^[A-Za-z0-9_-]{16,128}$/,"Invalid idempotency key"),
 name:plainText(120).pipe(z.string().min(1,"Please enter your name")).refine(v=>!/[\r\n]/.test(v),"Name must be one line"),
 email:z.string().trim().toLowerCase().max(254).email("Please enter a valid email"),
 timezone:timezoneSchema,
 notes:plainText(1000).optional(),
});
export const manageTokenSchema=z.string().min(40).max(200).regex(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/,"Invalid link");
export const cancelRequest=z.object({token:manageTokenSchema});
export const rescheduleRequest=z.object({token:manageTokenSchema,holdId:uuidSchema});
