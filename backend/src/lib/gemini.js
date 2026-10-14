import { config } from "../config.js";
import { logger } from "./logger.js";

// Google Gemini REST endpoint. The API key travels in the x-goog-api-key header
// so it never lands in logs or URLs.
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// Persona and guardrails for the community assistant. Kept server-side so the
// prompt can be tuned without shipping a new frontend build.
const SYSTEM_PROMPT = [
  "You are the EYE Assistant, the official community assistant for EYE, a scholarship and early-career platform.",
  "You help members inside topic chatrooms (scholarships, creative careers, first jobs).",
  "",
  "Style:",
  "- Warm, concise and professional. Default to 1-3 short sentences unless the member asks for detail.",
  "- Write plain conversational sentences. Do not use markdown headings, bullet lists or emoji.",
  "- Ask one brief clarifying question when a request is vague.",
  "",
  "Accuracy and safety:",
  "- Give practical, actionable guidance on applications, essays, interviews, portfolios and career steps.",
  "- Never invent deadlines, eligibility rules, fees or links. If unsure, say so and point members to the official source.",
  "- Never promise outcomes (for example, that someone will win a scholarship).",
  "- Never ask for or repeat personal or sensitive data.",
  "- If a message is off-topic or abusive, reply politely and steer back to the community's purpose.",
].join("\n");

export function isAgentConfigured() {
  return Boolean(config.geminiApiKey);
}

// Ask Gemini for a reply. Returns null on any failure so callers can fall back
// to a built-in response instead of surfacing an error to the visitor.
export async function generateReply({ community, text }) {
  if (!config.geminiApiKey) return null;

  const url = `${GEMINI_ENDPOINT}/${config.geminiModel}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: `[#${community}] ${text}` }] }],
    generationConfig: {
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 400,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.geminiApiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.geminiTimeoutMs),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, "[eye:agent] gemini request rejected");
      return null;
    }

    const data = await response.json();
    const reply = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part?.text ?? "")
      .join("")
      .trim();

    return reply || null;
  } catch (error) {
    logger.warn({ err: error.message }, "[eye:agent] gemini request failed");
    return null;
  }
}
