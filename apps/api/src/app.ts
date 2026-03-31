import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { env } from "./config.js";
import { logger } from "./lib/logger.js";
import healthRoutes from "./routes/health.js";
import messageRoutes from "./routes/messages.js";

const app = express();

app.use(pinoHttp({ logger }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.use(healthRoutes);
app.use(messageRoutes);

export default app;
