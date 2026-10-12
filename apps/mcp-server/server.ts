import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { existsSync } from 'node:fs';
import * as z from 'zod';
import { getAnomalies, getDashboardSummary, getRevenueByBranch } from './data.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

const app = createMcpExpressApp();
const mcpToken = process.env.MCP_API_TOKEN;

function createServer() {
  const server = new McpServer({ name: 'dashboard-mcp', version: '0.1.0' });
  const month = z.string().regex(/^\d{4}-\d{2}$/).default('2026-09');
  const response = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] });

  server.registerTool('get_dashboard_summary', {
    description: 'Returns trusted dashboard KPIs and branch breakdown for a month.',
    inputSchema: { month }
  }, async ({ month }) => response(getDashboardSummary({ month })));

  server.registerTool('get_revenue_by_branch', {
    description: 'Returns monthly revenue, cost, and orders grouped by branch.',
    inputSchema: { month }
  }, async ({ month }) => response(getRevenueByBranch({ month })));

  server.registerTool('get_revenue_anomalies', {
    description: 'Returns branches whose revenue dropped by 10% or more against the prior month.',
    inputSchema: { month }
  }, async ({ month }) => response(getAnomalies({ month })));
  return server;
}

app.post('/mcp', async (req, res) => {
  if (!mcpToken || req.get('authorization') !== `Bearer ${mcpToken}`) return res.status(401).json({ error: 'Unauthorized' });
  const month = req.get('x-dashboard-month');
  if (month && /^\d{4}-\d{2}$/.test(month) && req.body?.params?.arguments) req.body.params.arguments.month = month;
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: error instanceof Error ? error.message : 'Internal server error' }, id: null });
  } finally {
    res.on('close', () => Promise.all([transport.close(), server.close()]));
  }
});

app.listen(3001, () => console.log('MCP server: http://localhost:3001/mcp'));
