import "server-only";
import type {HostContext} from "@/core/domain/types";
import {getServices} from "./container";
import {ConfigurationError} from "./env";
import {slugSchema} from "./validation";

/** Page-level host lookup that degrades to "unconfigured" instead of crashing when env/DB are not set up yet. */
export async function loadPublicHost(slug:string):Promise<{state:"ok";ctx:HostContext}|{state:"missing"}|{state:"unconfigured"}>{
 if(!slugSchema.safeParse(slug).success)return{state:"missing"};
 try{const ctx=await getServices().hosts.getBySlug(slug);return ctx?{state:"ok",ctx}:{state:"missing"}}
 catch(err){if(err instanceof ConfigurationError)return{state:"unconfigured"};throw err}
}
