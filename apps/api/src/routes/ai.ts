import { Router, type Request } from "express";
import type { Logger } from "pino";
import { z } from "zod";
import { aiQueryBodySchema } from "../schemas/aiQueryBody.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type {
  AiQueryResponse,
  AiChatHistoryResponse,
  AiChatMessage,
  AiConversationsListResponse,
  AiConversation,
} from "@repo/shared";

const router = Router();

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const HISTORY_LIMIT = 10;

const SYSTEM_PROMPT = `You are an analytics assistant. You receive HTTP request log data from a web application and answer user questions about it.

Each log entry has these fields:
- method: HTTP method (GET, POST, etc.)
- path: request path (e.g. /api/sales, /health)
- statusCode: HTTP status code (200, 404, 500, etc.)
- responseTimeMs: response time in milliseconds
- ip: client IP address (can be used to infer geographic origin)
- userAgent: browser/client user-agent string
- createdAt: ISO 8601 timestamp

Analyze the data and answer the user's question. You MUST respond with ONLY valid JSON — no markdown, no code fences, no explanation outside the JSON.

Response format:
{ "answer": "your textual answer here", "data": [optional array of objects if a table would help illustrate the answer] }

If a table is not useful for the answer, omit the "data" field entirely.
Keep answers concise and data-driven.`;

const sessionIdSchema = z.string().uuid();

const LOG_BODY_PREVIEW = 4000;

function reqLog(req: Request): Logger {
  const withLog = req as Request & { log?: Logger };
  return withLog.log ?? logger;
}

function truncateForLog(s: string, max = LOG_BODY_PREVIEW): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[truncated ${s.length - max} chars]`;
}

function toConversationDto(c: {
  id: string;
  sessionId: string;
  title: string;
  createdAt: Date;
  archivedAt: Date | null;
}): AiConversation {
  return {
    id: c.id,
    sessionId: c.sessionId,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
    archivedAt: c.archivedAt?.toISOString() ?? null,
  };
}

// --- Conversations CRUD ---

router.get("/api/ai/conversations", async (req, res) => {
  const parsed = sessionIdSchema.safeParse(req.query.sessionId);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid sessionId" });
    return;
  }

  const conversations = await prisma.aiConversation.findMany({
    where: { sessionId: parsed.data, archivedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const response: AiConversationsListResponse = {
    conversations: conversations.map(toConversationDto),
  };
  res.json(response);
});

router.post("/api/ai/conversations", async (req, res) => {
  const parsed = z.object({ sessionId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid sessionId" });
    return;
  }

  const conversation = await prisma.aiConversation.create({
    data: { sessionId: parsed.data.sessionId },
  });

  res.status(201).json(toConversationDto(conversation));
});

router.delete("/api/ai/conversations/:id", async (req, res) => {
  const id = req.params.id;

  await prisma.aiConversation.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  res.json({ ok: true });
});

// --- Messages ---

router.get("/api/ai/conversations/:id/messages", async (req, res) => {
  const id = req.params.id;

  const messages = await prisma.aiChat.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });

  const response: AiChatHistoryResponse = {
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role as "user" | "assistant",
      content: m.content,
      data: m.data as AiChatMessage["data"],
      createdAt: m.createdAt.toISOString(),
    })),
  };
  res.json(response);
});

// --- AI Query ---

async function generateTitle(
  apiKey: string,
  question: string,
  answer: string,
  log: Logger,
): Promise<string> {
  try {
    const t0 = Date.now();
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 30,
        messages: [{
          role: "user",
          content: `Generate a short title (3-6 words, no quotes) for a chat that starts with this question and answer:\nQ: ${question}\nA: ${answer}`,
        }],
      }),
    });
    const durationMs = Date.now() - t0;

    if (!res.ok) {
      const errBody = await res.text();
      log.warn({
        ai: "title",
        phase: "anthropic_error",
        httpStatus: res.status,
        durationMs,
        bodyPreview: truncateForLog(errBody, 1500),
        bodyLen: errBody.length,
      }, "generateTitle: Anthropic non-OK");
      return "New chat";
    }

    const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
    const title = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "");

    log.info({ ai: "title", phase: "ok", durationMs, titleLen: title.length }, "generateTitle: success");
    return title || "New chat";
  } catch (err) {
    log.warn({ err, ai: "title", phase: "exception" }, "generateTitle: threw");
    return "New chat";
  }
}

router.post("/api/ai/query", async (req, res) => {
  const log = reqLog(req);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log.warn({ ai: "query", phase: "no_api_key" }, "ANTHROPIC_API_KEY missing");
    res.status(503).json({ error: "AI service is not configured" });
    return;
  }

  const parsed = aiQueryBodySchema.safeParse(req.body);
  if (!parsed.success) {
    log.info({ ai: "query", phase: "validation_failed", issues: parsed.error.flatten() }, "invalid body");
    res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { conversationId, question } = parsed.data;

  log.info({
    ai: "query",
    phase: "start",
    conversationId,
    questionLen: question.length,
    questionPreview: truncateForLog(question, 200),
  }, "AI query: received");

  try {
    const dbT0 = Date.now();
    const [logs, history, conversation] = await Promise.all([
      prisma.requestLog.findMany({
        select: {
          method: true,
          path: true,
          statusCode: true,
          responseTimeMs: true,
          ip: true,
          userAgent: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.aiChat.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      }),
      prisma.aiConversation.findUnique({
        where: { id: conversationId },
      }),
    ]);
    const dbMs = Date.now() - dbT0;

    log.info({
      ai: "query",
      phase: "db_loaded",
      conversationId,
      dbMs,
      requestLogRows: logs.length,
      priorChatTurns: history.length,
      conversationFound: Boolean(conversation),
    }, "AI query: Prisma load complete");

    if (!conversation) {
      log.warn({ ai: "query", phase: "conversation_not_found", conversationId }, "unknown conversation");
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await prisma.aiChat.create({
      data: { conversationId, role: "user", content: question },
    });

    const isFirstMessage = history.length === 0;

    const historyMessages = history
      .reverse()
      .map((msg) => ({ role: msg.role as "user" | "assistant", content: msg.content }));

    const userMessage = `Here are the latest ${logs.length} HTTP request logs:\n\n${JSON.stringify(logs)}\n\nQuestion: ${question}`;

    const messagesPayload = [...historyMessages, { role: "user" as const, content: userMessage }];
    const approxUserPayloadChars = messagesPayload.reduce((n, m) => n + m.content.length, 0);

    log.info({
      ai: "query",
      phase: "anthropic_request",
      conversationId,
      model: MODEL,
      messageCount: messagesPayload.length,
      approxUserPayloadChars,
      systemPromptChars: SYSTEM_PROMPT.length,
    }, "AI query: calling Anthropic");

    const anthropicT0 = Date.now();
    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messagesPayload,
      }),
    });
    const anthropicMs = Date.now() - anthropicT0;

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      log.error({
        ai: "query",
        phase: "anthropic_http_error",
        conversationId,
        httpStatus: anthropicRes.status,
        durationMs: anthropicMs,
        bodyLen: errBody.length,
        bodyPreview: truncateForLog(errBody),
      }, "Anthropic returned non-2xx (client gets 502)");
      res.status(502).json({ error: "AI service returned an error" });
      return;
    }

    const anthropicData = (await anthropicRes.json()) as {
      content: Array<{ type: string; text: string }>;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const rawText = anthropicData.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    log.info({
      ai: "query",
      phase: "anthropic_ok",
      conversationId,
      durationMs: anthropicMs,
      stopReason: anthropicData.stop_reason,
      usage: anthropicData.usage,
      assistantTextChars: rawText.length,
      assistantPreview: truncateForLog(rawText, 300),
    }, "Anthropic response OK");

    let result: AiQueryResponse;
    try {
      result = JSON.parse(rawText) as AiQueryResponse;
    } catch (parseErr) {
      log.warn({
        err: parseErr,
        ai: "query",
        phase: "json_parse_fallback",
        conversationId,
        rawPreview: truncateForLog(rawText, 500),
      }, "Assistant text was not JSON; returning as plain answer");
      result = { answer: rawText };
    }

    await prisma.aiChat.create({
      data: {
        conversationId,
        role: "assistant",
        content: result.answer,
        data: result.data ? JSON.parse(JSON.stringify(result.data)) : undefined,
      },
    });

    if (isFirstMessage) {
      const titleT0 = Date.now();
      const title = await generateTitle(apiKey, question, result.answer, log);
      await prisma.aiConversation.update({
        where: { id: conversationId },
        data: { title },
      });
      log.info({
        ai: "query",
        phase: "title_updated",
        conversationId,
        titleMs: Date.now() - titleT0,
        title,
      }, "Conversation title set");
    }

    log.info({ ai: "query", phase: "complete", conversationId }, "AI query: success");
    res.json(result);
  } catch (err) {
    log.error(
      { err, ai: "query", phase: "unhandled_exception", conversationId },
      "AI query failed (client gets 500)",
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
