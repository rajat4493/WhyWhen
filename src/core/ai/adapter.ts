import type {IntentDecision} from "../domain/types";
export type AiRuntimeConfig={mode:"mock"|"gateway"|"openai-compatible";model?:string;baseUrl?:string;apiKey?:string};
export interface IntentAiAdapter{decide(intent:string,config:AiRuntimeConfig):Promise<IntentDecision>}
