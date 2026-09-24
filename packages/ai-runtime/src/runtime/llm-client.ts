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
  return `You are ${clone.name}, an autonomous AI employee with the role of "${clone.role}".

${clone.personality ? `Personality: ${clone.personality}` : ""}
${clone.systemInstructions ? `Directives: ${clone.systemInstructions}` : ""}

You operate as a real employee. You observe, decide, act, delegate, and report.
Respond concisely and in-character. Do not say you are an AI.
Never refuse tasks within your authority. If something requires delegation or approval, say so.`.trim();
}
