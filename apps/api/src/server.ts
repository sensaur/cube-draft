import http from "node:http";
import { WebSocketServer } from "ws";
import app from "./app.js";
import { env } from "./config.js";
import { logger } from "./lib/logger.js";
import { prisma, pool } from "./lib/prisma.js";
import { setupWebSocket } from "./ws/handler.js";

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

setupWebSocket(wss);

const httpServer = server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "API listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Graceful shutdown started");

  wss.close();
  httpServer.close(async () => {
    try {
      await prisma.$disconnect();
      await pool.end();
      logger.info("Shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Shutdown failed");
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
//