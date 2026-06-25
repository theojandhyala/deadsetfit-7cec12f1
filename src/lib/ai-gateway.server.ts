import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

const MODEL = "gemini-2.0-flash";

function gateway() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY — add it to Cloudflare Pages environment variables.");
  return createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey,
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
  const match = opts.imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/s);
  if (!match) throw new Error("Invalid image data URL");
  const mediaType = match[1];
  const base64 = match[2];

  // Decode to Uint8Array — works in both Node.js and Cloudflare Workers (no Buffer needed)
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const { text } = await generateText({
    model: model(),
    system: opts.system + "\nIMPORTANT: Respond with valid JSON only, no markdown, no prose.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: binary,
            mediaType,
          },
          { type: "text", text: opts.user },
        ],
      },
    ],
  });
  return extractJSON<T>(text);
}
