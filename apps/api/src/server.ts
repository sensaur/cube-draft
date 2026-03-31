import http from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import pino from "pino";
import pinoHttp from "pino-http";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { env } from "./config.js";

const logger = pino({ level: env.NODE_ENV === "production" ? "info" : "debug" });
const pool = new Pool({ connectionString: env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(pinoHttp({ logger }));
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api" });
});

app.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch (error) {
    reqLog(res).error({ err: error }, "Readiness check failed");
    res.status(503).json({ ok: false, db: "down" });
  }
});

app.get("/messages", async (_req, res) => {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 50
  });
  res.json(messages);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "connected", payload: { ok: true } }));

  socket.on("message", async (raw) => {
    try {
      const data = JSON.parse(String(raw));
      if (data?.type === "message:create" && typeof data?.payload?.text === "string") {
        const saved = await prisma.message.create({
          data: { text: data.payload.text }
        });

        const event = JSON.stringify({ type: "message:created", payload: saved });
        for (const client of wss.clients) {
          if (client.readyState === 1) client.send(event);
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Invalid WS payload");
      socket.send(JSON.stringify({ type: "error", payload: { message: "Invalid payload" } }));
    }
  });
});

const httpServer = server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API listening");
});

function reqLog(res: express.Response) {
  return (res as any).log ?? logger;
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Graceful shutdown started");

  wss.close();
  httpServer.close(async () => {
    try {
      await prisma.$disconnect();
      await pool.end();
      logger.info("Prisma disconnected");
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Shutdown failed");
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));