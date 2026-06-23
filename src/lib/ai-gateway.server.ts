// Server-only Anthropic Messages API helper.

const BASE = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

type AnthropicMessage = {
  role: "user" | "assistant";
  content: unknown;
};

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
};

async function callAnthropic(opts: {
  model?: string;
  system: string;
  messages: AnthropicMessage[];
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");

  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: 2048,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as AnthropicResponse;
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limit exceeded. Please retry shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(data.error?.message ?? `Anthropic API error ${res.status}`);
  }

  return data.content?.find((block) => block.type === "text")?.text ?? "";
}

function parseJSON<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("AI returned invalid JSON");
  }
}

export async function chatJSON<T = unknown>(opts: {
  model?: string;
  system: string;
  user: string;
}): Promise<T> {
  const content = await callAnthropic({
    model: opts.model,
    system: `${opts.system}\nReturn only valid JSON with no markdown fences.`,
    messages: [{ role: "user", content: opts.user }],
  });
  return parseJSON<T>(content);
}

export async function chatText(opts: {
  model?: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  return callAnthropic({
    model: opts.model,
    system: opts.system,
    messages: opts.messages,
  });
}

export async function chatVisionJSON<T = unknown>(opts: {
  model?: string;
  system: string;
  user: string;
  imageDataUrl: string;
}): Promise<T> {
  const match = opts.imageDataUrl.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/s);
  if (!match) throw new Error("Unsupported image format");

  const content = await callAnthropic({
    model: opts.model,
    system: `${opts.system}\nReturn only valid JSON with no markdown fences.`,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } },
        { type: "text", text: opts.user },
      ],
    }],
  });
  return parseJSON<T>(content);
}
