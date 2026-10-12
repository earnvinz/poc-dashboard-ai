import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  answerWithRemoteMcp,
  dashboardWithRemoteMcp,
  fallbackAnswer,
} from "./ai.ts";

const app = express();
app.use(express.json());
const root = dirname(fileURLToPath(import.meta.url));

app.get("/api/dashboard", async (req, res) => {
  const month =
    typeof req.query.month === "string" ? req.query.month : "2026-09";
  if (!/^\d{4}-\d{2}$/.test(month))
    return res.status(400).json({ error: "month must use YYYY-MM" });
  try {
    res.json(await dashboardWithRemoteMcp(month));
  } catch (error) {
    console.log("🚀 ~ error:", error);
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to fetch dashboard data",
    });
  }
});

app.post("/api/ask", async (req, res) => {
  const { month, question } = req.body as {
    month?: unknown;
    question?: unknown;
  };
  if (
    typeof month !== "string" ||
    !/^\d{4}-\d{2}$/.test(month) ||
    typeof question !== "string" ||
    !question.trim() ||
    question.length > 500
  ) {
    return res.status(400).json({
      error: "month must use YYYY-MM and question must be 1-500 characters",
    });
  }
  try {
    res.json({ answer: await answerWithRemoteMcp(question.trim(), month) });
  } catch {
    res.json({ answer: await fallbackAnswer(question.trim()) });
  }
});

app.use(express.static(join(root, "../web")));
app.listen(3000, () => console.log("Dashboard: http://localhost:3000"));
