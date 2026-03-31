import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/messages", async (_req, res) => {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(messages);
});

export default router;
