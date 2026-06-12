import Anthropic from "@anthropic-ai/sdk";

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY — add it to your environment.");
  return new Anthropic({ apiKey });
}

const MODEL = "claude-opus-4-8";

export async function chatJSON<T = unknown>(opts: {
  system: string;
  user: string;
}): Promise<T> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: opts.system + "\nIMPORTANT: Respond with valid JSON only, no markdown, no prose.",
    messages: [{ role: "user", content: opts.user }],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("AI returned invalid JSON");
  }
}

export async function chatText(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: opts.system,
    messages: opts.messages,
  });

  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");
}

export async function chatVisionJSON<T = unknown>(opts: {
  system: string;
  user: string;
  imageDataUrl: string;
}): Promise<T> {
  const client = getClient();

  // Parse data URL into media_type + base64 data
  const match = opts.imageDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/s);
  if (!match) throw new Error("Invalid image data URL");
  const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const base64Data = match[2];

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: opts.system + "\nIMPORTANT: Respond with valid JSON only, no markdown, no prose.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          { type: "text", text: opts.user },
        ],
      },
    ],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI returned invalid JSON");
  }
}
