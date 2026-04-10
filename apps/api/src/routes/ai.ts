import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { AiQueryResponse } from "@repo/shared";

const router = Router();

const querySchema = z.object({
  question: z.string().min(1).max(500),
});

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

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

router.post("/api/ai/query", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "AI service is not configured" });
    return;
  }

  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { question } = parsed.data;

  try {
    const logs = await prisma.requestLog.findMany({
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
    });

    const userMessage = `Here are the latest ${logs.length} HTTP request logs:\n\n${JSON.stringify(logs)}\n\nQuestion: ${question}`;

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
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      logger.error({ status: anthropicRes.status, body: errBody }, "Anthropic API error");
      res.status(502).json({ error: "AI service returned an error" });
      return;
    }

    const anthropicData = (await anthropicRes.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const rawText = anthropicData.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    let result: AiQueryResponse;
    try {
      result = JSON.parse(rawText) as AiQueryResponse;
    } catch {
      result = { answer: rawText };
    }

    res.json(result);
  } catch (err) {
    logger.error(err, "AI query failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
