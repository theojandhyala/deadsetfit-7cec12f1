import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

const GEMINI_MODEL = "gemini-2.0-flash";
const ANTHROPIC_MODEL = "claude-opus-4-8";

// Use whichever provider key is configured in the deployment environment.
// Gemini takes precedence if both are present.
function model() {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return createOpenAICompatible({
      name: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: geminiKey,
    })(GEMINI_MODEL);
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return createAnthropic({ apiKey: anthropicKey })(ANTHROPIC_MODEL);
  }
  throw new Error(
    "Missing AI key — set GEMINI_API_KEY or ANTHROPIC_API_KEY in Cloudflare Pages environment variables.",
  );
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

// Hard deadline on every LLM call so a hung upstream request can't leave the
// UI spinning forever.
const LLM_TIMEOUT_MS = 60_000;

export async function chatJSON<T = unknown>(opts: { system: string; user: string }): Promise<T> {
  const { text } = await generateText({
    model: model(),
    system: opts.system + "\nIMPORTANT: Respond with valid JSON only, no markdown, no prose.",
    prompt: opts.user,
    abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
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
    abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  return text;
}

export async function chatVisionJSON<T = unknown>(opts: {
  system: string;
  user: string;
  imageDataUrl: string;
}): Promise<T> {
  const match = opts.imageDataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
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
    abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  return extractJSON<T>(text);
}
