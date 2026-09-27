/**
 * LLM Client — shared Mistral AI caller for the Runtime Engine.
 *
 * Every clone thinks through Mistral. This is the single place where
 * the runtime calls the LLM. It uses the clone's configured model with
 * a fallback chain so the engine is never completely silent.
 */

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

const MODEL_FALLBACK_CHAIN = [
  "mistral-small-latest",
  "open-mistral-7b",
  "open-mixtral-8x7b",
];

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
export async function callLLM(input: LLMCallInput): Promise<LLMCallResult> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return { success: false, content: "", error: "MISTRAL_API_KEY not configured" };
  }

  const modelsToTry = [
    input.preferredModel,
    ...MODEL_FALLBACK_CHAIN,
  ].filter((m): m is string => !!m);

  // Deduplicate while preserving order
  const uniqueModels = [...new Set(modelsToTry)];

  let lastError = "";
  for (const model of uniqueModels) {
    try {
      const res = await fetch(MISTRAL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          temperature: input.temperature ?? 0.4,
          max_tokens: input.maxTokens ?? 400,
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim() || "";
        if (content) {
          return { success: true, content, modelUsed: model };
        }
      } else {
        const text = await res.text();
        lastError = `${model} (${res.status}): ${text.slice(0, 200)}`;
      }
    } catch (err: any) {
      lastError = `${model}: ${err?.message || "network error"}`;
    }
  }

  return { success: false, content: "", error: lastError };
}

/**
 * Build a grounded system prompt for a clone.
 * This is what makes every clone an individual — their identity, role,
 * personality, and directives shape every response.
 */
export function buildCloneSystemPrompt(clone: {
  name: string;
  role: string;
  personality?: string;
  systemInstructions?: string;
}): string {
  return `You are ${clone.name}, a real human teammate working as "${clone.role}".

${clone.personality ? `Your Personality: ${clone.personality}` : ""}
${clone.systemInstructions ? `Your Directives: ${clone.systemInstructions}` : ""}

CRITICAL TRUTHFULNESS & HUMAN TONE DIRECTIVES:
1. Speak naturally like a real human coworker in Slack/Teams. Adapt your vocabulary and tone to match your specified Personality. Avoid rigid corporate jargon.
2. NEVER invent, fabricate, or assume fake meetings, fake open rates, fake code deployments, fake marketing campaigns, or fake numbers under any circumstances.
3. If no real live data or new action item exists, state simply that routine monitoring is active and no critical alerts were triggered. Output NO_UPDATE if there is nothing real to report.
4. Base all updates strictly on real task data and real tool output provided in the prompt.`.trim();
}
