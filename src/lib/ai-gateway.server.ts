// Server-only helper for calling Lovable AI Gateway directly via fetch.
// Kept simple (no AI SDK dependency) for plain JSON requests.

const BASE = "https://ai.gateway.lovable.dev/v1";

export async function chatJSON<T = unknown>(opts: {
  model?: string;
  system: string;
  user: string;
}): Promise<T> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-3-flash-preview",
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
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
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

export async function chatVisionJSON<T = unknown>(opts: {
  model?: string;
  system: string;
  user: string;
  imageDataUrl: string;
}): Promise<T> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: [
          { type: "text", text: opts.user },
          { type: "image_url", image_url: { url: opts.imageDataUrl } },
        ]},
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
  try { return JSON.parse(content) as T; }
  catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI returned invalid JSON");
  }
}
