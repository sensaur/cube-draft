import type { WebSocketServer, WebSocket } from "ws";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export function setupWebSocket(wss: WebSocketServer) {
  wss.on("connection", (socket: WebSocket) => {
    socket.send(JSON.stringify({ type: "connected", payload: { ok: true } }));

    socket.on("message", async (raw) => {
      try {
        const data = JSON.parse(String(raw));

        if (data?.type === "message:create" && typeof data?.payload?.text === "string") {
          const saved = await prisma.message.create({
            data: { text: data.payload.text },
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
}
