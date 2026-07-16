import "server-only";

/**
 * Minimal OpenRouter chat-completions client for the AI Quick Add feature.
 *
 * We deliberately avoid an SDK: a single JSON `fetch` keeps the dependency
 * surface small and the request shape obvious. The key is read from the
 * environment at call time and never leaves the server (Quick Add runs as a
 * server action).
 *
 * The client speaks the OpenAI-style tool-calling protocol: pass `tools` and the
 * model may reply with `tool_calls` instead of prose. The caller runs those
 * tools and feeds the results back as `role:"tool"` messages, looping until the
 * model answers with plain content — see `runQuickAdd` in ./quick-add.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** The model the Quick Add agent runs on. */
export const QUICK_ADD_MODEL = "ibm-granite/granite-4.1-8b";

/** A tool the model chose to call, with its raw (unparsed) JSON arguments. */
export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

/** A function tool advertised to the model (OpenAI-style JSON Schema params). */
export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/** The assistant's reply: prose, tool calls, or both. */
export type AssistantMessage = {
  content: string | null;
  tool_calls?: ToolCall[];
};

/** Thrown when OpenRouter is misconfigured or returns an error. */
export class OpenRouterError extends Error {}

type ChatOptions = {
  /** Tools the model may call this turn. Omit for a plain completion. */
  tools?: ToolSchema[];
  signal?: AbortSignal;
};

/**
 * Send one chat turn and return the assistant's message.
 *
 * `temperature: 0` keeps the agent deterministic — the same phrase maps to the
 * same tool calls. When `tools` are supplied we advertise them with
 * `tool_choice: "auto"`, letting the model decide whether to call a tool or
 * answer directly; the returned message then carries `tool_calls`, `content`,
 * or both.
 */
export async function chat(
  messages: ChatMessage[],
  { tools, signal }: ChatOptions = {},
): Promise<AssistantMessage> {
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
      messages,
      ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OpenRouterError(
      `OpenRouter request failed (${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: AssistantMessage }[];
  };
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new OpenRouterError("OpenRouter returned an empty response.");
  }
  return { content: message.content ?? null, tool_calls: message.tool_calls };
}
