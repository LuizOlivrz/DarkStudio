/**
 * Netlify Function: secure proxy for the NightCoder Groq API.
 *
 * Configure GROQ_API_KEY in Netlify's environment variables. Never put the
 * provider key in browser-delivered JavaScript.
 */
const ALLOWED_ORIGINS = new Set([
  "https://darkstudio-code.netlify.app",
  "https://darkstudio-code.com",
  "https://dscode.dev",
]);
const MODEL = "openai/gpt-oss-120b";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 20000;
const MAX_TOTAL_LENGTH = 40000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const requestsByIP = new Map();

export default async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
  }

  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "Origin not allowed." }, 403);
  }

  // Best-effort per-instance limit to curb bursts. Use platform-level persistent
  // rate limiting as well for a public production deployment.
  const now = Date.now();
  for (const [ip, entry] of requestsByIP) {
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) requestsByIP.delete(ip);
  }
  const ip =
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const current = requestsByIP.get(ip);
  if (current && now - current.windowStart < RATE_LIMIT_WINDOW_MS) {
    if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
      return json({ error: "Too many requests. Please try again later." }, 429, {
        "Retry-After": String(Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.windowStart)) / 1000)),
      });
    }
    current.count += 1;
  } else {
    requestsByIP.set(ip, { windowStart: now, count: 1 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 50000) {
    return json({ error: "Request body is too large." }, 413);
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json({ error: "NightCoder is not configured yet." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return json({ error: "Invalid message history." }, 400);
  }

  let totalLength = 0;
  const safeMessages = [];
  for (const message of messages) {
    if (
      !message ||
      !["system", "user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      message.content.length > MAX_MESSAGE_LENGTH
    ) {
      return json({ error: "Invalid message format." }, 400);
    }
    totalLength += message.content.length;
    safeMessages.push({ role: message.role, content: message.content });
  }
  if (totalLength > MAX_TOTAL_LENGTH) {
    return json({ error: "Message history is too large." }, 413);
  }

  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODEL, messages: safeMessages }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("NightCoder provider request failed:", upstream.status);
      return json(
        { error: upstream.status === 429
            ? "NightCoder is busy. Please wait a moment and try again."
            : "NightCoder could not complete the request." },
        upstream.status === 429 ? 429 : 502,
      );
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string") {
      return json({ error: "The AI provider returned an invalid response." }, 502);
    }
    return json({ reply }, 200);
  } catch (error) {
    console.error("NightCoder network error:", error);
    return json({ error: "NightCoder is temporarily unavailable." }, 502);
  }
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}
