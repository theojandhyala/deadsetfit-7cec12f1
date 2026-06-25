import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

const MODEL = "google/gemini-3-flash-preview";

function gateway() {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY — Lovable AI is not configured.");
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

function model() {
  return gateway()(MODEL);
}

function extractJSON<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]) as T;
      } catch {
        /* fall through */
      }
    }
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("AI returned invalid JSON");
  }
}

export async function chatJSON<T = unknown>(opts: { system: string; user: string }): Promise<T> {
  const { text } = await generateText({
    model: model(),
    system: opts.system + "\nIMPORTANT: Respond with valid JSON only, no markdown, no prose.",
    prompt: opts.user,
  });
  return extractJSON<T>(text);
}

export async function chatText(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const { text } = await generateText({
    model: model(),
    system: opts.system,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return text;
}

export async function chatVisionJSON<T = unknown>(opts: {
  system: string;
  user: string;
  imageDataUrl: string;
}): Promise<T> {
  const match = opts.imageDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/s);
  if (!match) throw new Error("Invalid image data URL");
  const mediaType = match[1];
  const base64 = match[2];

  const { text } = await generateText({
    model: model(),
    system: opts.system + "\nIMPORTANT: Respond with valid JSON only, no markdown, no prose.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: Buffer.from(base64, "base64"),
            mediaType,
          },
          { type: "text", text: opts.user },
        ],
      },
    ],
  });
  return extractJSON<T>(text);
}
