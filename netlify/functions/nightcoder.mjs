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
const MAX_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 20000;
const MAX_TOTAL_LENGTH = 40000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const requestsByIP = new Map();
const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_workspace_files",
      description: "Lista arquivos e pastas do Workspace ativo, incluindo caminhos e metadados.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "read_workspace_file",
      description: "Lê o conteúdo de um arquivo de texto existente no Workspace ativo.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Caminho relativo do arquivo no Workspace." } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_workspace_file",
      description: "Cria ou altera um arquivo de texto no Workspace. A interface sempre solicitará aprovação explícita ao usuário antes de gravar.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Caminho relativo do arquivo." },
          content: { type: "string", description: "Conteúdo integral do arquivo." },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
];


export default async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
  }

  const origin = request.headers.get("origin");
  const isDeployPreview =
    typeof origin === "string" &&
    /^https:\/\/(?:deploy-preview-\d+|[a-z0-9-]+)--darkstudio-code\.netlify\.app$/.test(origin);
  if (!origin || (!ALLOWED_ORIGINS.has(origin) && !isDeployPreview)) {
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
      !["system", "user", "assistant", "tool"].includes(message.role) ||
      typeof message.content !== "string" ||
      message.content.length > MAX_MESSAGE_LENGTH
    ) {
      return json({ error: "Invalid message format." }, 400);
    }
    totalLength += message.content.length;
    const safeMessage = { role: message.role, content: message.content };
    if (message.role === "tool") {
      if (typeof message.tool_call_id !== "string" || message.tool_call_id.length > 128) {
        return json({ error: "Invalid tool response." }, 400);
      }
      safeMessage.tool_call_id = message.tool_call_id;
    }
    if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
      if (message.tool_calls.length > 4) return json({ error: "Too many tool calls." }, 400);
      safeMessage.tool_calls = message.tool_calls.filter((call) =>
        call && typeof call.id === "string" &&
        call.type === "function" &&
        typeof call.function?.name === "string" &&
        typeof call.function?.arguments === "string"
      );
    }
    safeMessages.push(safeMessage);
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
      body: JSON.stringify({ model: MODEL, messages: safeMessages, tools: AGENT_TOOLS, tool_choice: "auto" }),
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

    const assistantMessage = data?.choices?.[0]?.message;
    if (Array.isArray(assistantMessage?.tool_calls) && assistantMessage.tool_calls.length) {
      const toolCalls = assistantMessage.tool_calls.filter((call) =>
        call?.type === "function" &&
        typeof call.id === "string" &&
        AGENT_TOOLS.some((tool) => tool.function.name === call.function?.name) &&
        typeof call.function?.arguments === "string"
      ).slice(0, 4);
      if (toolCalls.length) {
        return json({
          intermediate: typeof assistantMessage.content === "string" ? assistantMessage.content : "",
          toolCalls,
        }, 200);
      }
    }

    const reply = assistantMessage?.content;
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
