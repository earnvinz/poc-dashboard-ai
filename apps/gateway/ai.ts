import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const model = process.env.GROQ_MODEL ?? 'openai/gpt-oss-20b';
const toolNames = ['get_dashboard_summary', 'get_revenue_by_branch', 'get_revenue_anomalies'];

export function parseGroqText(response: unknown): string | null {
  const text = (response as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }).output
    ?.filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text ?? '')
    .join('').trim();
  return text || null;
}

export function parseDashboard(response: unknown): { summary: Record<string, unknown>; anomalies: unknown[] } {
  const text = parseGroqText(response);
  if (!text) throw new Error('Groq returned no dashboard data');
  const data = JSON.parse(text) as { summary?: unknown; anomalies?: unknown };
  if (!data.summary || typeof data.summary !== 'object' || !Array.isArray(data.anomalies)) throw new Error('Groq returned an invalid dashboard response');
  return { summary: data.summary as Record<string, unknown>, anomalies: data.anomalies };
}

async function generate(input: string, tools: unknown[] = []): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');
  const response = await fetch('https://api.groq.com/openai/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input, ...(tools.length ? { tools } : {}) })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`Groq request failed (${response.status}): ${error.error?.message ?? 'Unknown error'}`);
  }
  return response.json();
}

export async function answerWithRemoteMcp(question: string, month: string): Promise<string> {
  const url = process.env.MCP_REMOTE_URL;
  const token = process.env.MCP_API_TOKEN;
  if (!url || !token) throw new Error('MCP_REMOTE_URL and MCP_API_TOKEN must be set');
  const response = await generate(`Answer the dashboard question for ${month}. Use only MCP tool results for business facts and do not invent figures.\n\nQuestion: ${question}`, [{
    type: 'mcp',
    server_label: 'dashboard_mcp',
    server_url: url,
    headers: { Authorization: `Bearer ${token}`, 'x-dashboard-month': month },
    server_description: 'Trusted monthly revenue dashboard data. Use it for every business fact or figure.',
    require_approval: 'never',
    allowed_tools: toolNames
  }]);
  return parseGroqText(response) ?? 'AI returned no answer.';
}

export async function dashboardWithRemoteMcp(month: string): Promise<{ summary: Record<string, unknown>; anomalies: unknown[] }> {
  const url = process.env.MCP_REMOTE_URL;
  const token = process.env.MCP_API_TOKEN;
  if (!url || !token) throw new Error('MCP_REMOTE_URL and MCP_API_TOKEN must be set');
  const response = await generate(`Use the MCP tools to get the dashboard summary and revenue anomalies for ${month}. Return only JSON with this exact shape: {"summary": <dashboard summary tool result>, "anomalies": <revenue anomalies tool result>}. Do not use Markdown.`, [{
    type: 'mcp',
    server_label: 'dashboard_mcp',
    server_url: url,
    headers: { Authorization: `Bearer ${token}`, 'x-dashboard-month': month },
    server_description: 'Trusted monthly revenue dashboard data. Use it for every business fact or figure.',
    require_approval: 'never',
    allowed_tools: toolNames
  }]);
  return parseDashboard(response);
}

export async function fallbackAnswer(question: string): Promise<string> {
  try {
    const response = await generate(`The selected dashboard data is unavailable. Answer this question with general guidance only; do not invent business facts or figures.\n\nQuestion: ${question}`);
    return parseGroqText(response) ?? 'No verified dashboard data is available.';
  } catch {
    return 'No verified dashboard data is available. Set GROQ_API_KEY to enable general AI guidance.';
  }
}
