/**
 * LLM Client — shared Mistral AI caller for the Runtime Engine.
 *
 * Every clone thinks through Mistral. This is the single place where
 * the runtime calls the LLM. It uses the clone's configured model with
 * a fallback chain so the engine is never completely silent.
 */
export type LLMMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};
export type LLMCallInput = {
    /** The clone's configured model — tried first */
    preferredModel?: string;
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
};
export type LLMCallResult = {
    success: boolean;
    content: string;
    modelUsed?: string;
    error?: string;
};
/**
 * Call Mistral with a fallback chain.
 * Returns the generated text or an error.
 */
export declare function callLLM(input: LLMCallInput): Promise<LLMCallResult>;
/**
 * Build a grounded system prompt for a clone.
 * This is what makes every clone an individual — their identity, role,
 * personality, and directives shape every response.
 */
export declare function buildCloneSystemPrompt(clone: {
    name: string;
    role: string;
    personality?: string;
    systemInstructions?: string;
}): string;
//# sourceMappingURL=llm-client.d.ts.map