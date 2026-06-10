// Server-only helper for calling OpenAI-compatible AI API directly via fetch.
// Kept simple (no AI SDK dependency) for plain JSON requests.

const BASE = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";

export async function chatJSON<T = unknown>(opts: {
  model?: string;
  system: string;
  user: string;
}): Promise<T> {
  const key = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limit exceeded. Please retry shortly.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Please check your API key and billing.");
    throw new Error(`AI gateway error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as T;
  } catch {
    // try to extract JSON if model wrapped it
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("AI returned invalid JSON");
  }
}

export async function chatText(opts: {
  model?: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const key = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limit exceeded. Please retry shortly.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Please check your API key and billing.");
    throw new Error(`AI gateway error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function chatVisionJSON<T = unknown>(opts: {
  model?: string;
  system: string;
  user: string;
  imageDataUrl: string;
}): Promise<T> {
  const key = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },

    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: opts.system },
        {
          role: "user",
          content: [
            { type: "text", text: opts.user },
            { type: "image_url", image_url: { url: opts.imageDataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limit exceeded. Please retry shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(`AI gateway error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as T;
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI returned invalid JSON");
  }
}
