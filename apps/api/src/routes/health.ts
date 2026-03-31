import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api" });
});

router.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch (error) {
    logger.error({ err: error }, "Readiness check failed");
    res.status(503).json({ ok: false, db: "down" });
  }
});

export default router;
