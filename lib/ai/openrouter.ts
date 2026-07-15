import "server-only";

/**
 * Minimal OpenRouter chat-completions client for the AI Quick Add feature.
 *
 * We deliberately avoid an SDK: a single JSON `fetch` keeps the dependency
 * surface small and the request shape obvious. The key is read from the
 * environment at call time and never leaves the server (Quick Add runs as a
 * server action).
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** The model the Quick Add parser runs on. */
export const QUICK_ADD_MODEL = "ibm-granite/granite-4.1-8b";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** Thrown when OpenRouter is misconfigured or returns an error. */
export class OpenRouterError extends Error {}

/**
 * Send a chat completion and return the assistant's raw message content.
 *
 * `response_format: json_object` asks the model to emit strictly a JSON object,
 * which the caller then parses and validates. `temperature: 0` keeps parsing
 * deterministic — we want the same phrase to map to the same operations.
 */
export async function chatJson(
  messages: ChatMessage[],
  { signal }: { signal?: AbortSignal } = {},
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError(
      "OPENROUTER_API_KEY is not set — Quick Add can't reach the model.",
    );
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: QUICK_ADD_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OpenRouterError(
      `OpenRouter request failed (${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new OpenRouterError("OpenRouter returned an empty response.");
  }
  return content;
}
