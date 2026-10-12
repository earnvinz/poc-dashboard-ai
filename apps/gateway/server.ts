import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { answerWithRemoteMcp, fallbackAnswer } from './ai.ts';

const app = express();
app.use(express.json());
const allowedTools = new Set(['get_dashboard_summary', 'get_revenue_by_branch', 'get_revenue_anomalies']);
const root = dirname(fileURLToPath(import.meta.url));
const mcpToken = process.env.MCP_API_TOKEN;

async function callTool(name: string, args: Record<string, string>) {
  if (!allowedTools.has(name)) throw new Error(`Tool ${name} is not allowed by this gateway`);
  const client = new Client({ name: 'dashboard-gateway', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost:3001/mcp'), {
    requestInit: { headers: mcpToken ? { authorization: `Bearer ${mcpToken}` } : {} }
  });
  try {
    await client.connect(transport);
    const result = await client.request({ method: 'tools/call', params: { name, arguments: args } }, CallToolResultSchema);
    return result.structuredContent ?? JSON.parse(result.content.find((item) => item.type === 'text')?.text ?? '{}');
  } finally {
    await transport.close();
  }
}

app.get('/api/dashboard', async (req, res) => {
  const month = typeof req.query.month === 'string' ? req.query.month : '2026-09';
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must use YYYY-MM' });
  try {
    const [summary, anomalies] = await Promise.all([
      callTool('get_dashboard_summary', { month }),
      callTool('get_revenue_anomalies', { month })
    ]);
    res.json({ summary, anomalies });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to fetch dashboard data' });
  }
});

app.post('/api/ask', async (req, res) => {
  const { month, question } = req.body as { month?: unknown; question?: unknown };
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month) || typeof question !== 'string' || !question.trim() || question.length > 500) {
    return res.status(400).json({ error: 'month must use YYYY-MM and question must be 1-500 characters' });
  }
  try {
    res.json({ answer: await answerWithRemoteMcp(question.trim(), month) });
  } catch {
    res.json({ answer: await fallbackAnswer(question.trim()) });
  }
});

app.use(express.static(join(root, '../web')));
app.listen(3000, () => console.log('Dashboard: http://localhost:3000'));
