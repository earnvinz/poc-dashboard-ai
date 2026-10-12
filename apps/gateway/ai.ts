import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const model = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';
const toolNames = ['get_dashboard_summary', 'get_revenue_by_branch', 'get_revenue_anomalies'];

export function parseGeminiText(response: unknown): string | null {
  const text = (response as { steps?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).steps
    ?.flatMap((step) => step.content ?? [])
    .filter((content) => content.type === 'text')
    .map((content) => content.text ?? '')
    .join('').trim();
  return text || null;
}

async function generate(input: string, tools: unknown[] = []): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ model, input, store: false, ...(tools.length ? { tools } : {}) })
  });
  if (!response.ok) throw new Error('Gemini is unavailable');
  return response.json();
}

export async function answerWithRemoteMcp(question: string, month: string): Promise<string> {
  const url = process.env.MCP_REMOTE_URL;
  const token = process.env.MCP_API_TOKEN;
  if (!url || !token) throw new Error('MCP_REMOTE_URL and MCP_API_TOKEN must be set');
  const response = await generate(`Answer the dashboard question for ${month}. Use only MCP tool results for business facts and do not invent figures.\n\nQuestion: ${question}`, [{
    type: 'mcp_server',
    name: 'dashboard_mcp',
    url,
    headers: { authorization: `Bearer ${token}`, 'x-dashboard-month': month },
    allowed_tools: toolNames
  }]);
  return parseGeminiText(response) ?? 'AI returned no answer.';
}

export async function fallbackAnswer(question: string): Promise<string> {
  try {
    const response = await generate(`The selected dashboard data is unavailable. Answer this question with general guidance only; do not invent business facts or figures.\n\nQuestion: ${question}`);
    return parseGeminiText(response) ?? 'No verified dashboard data is available.';
  } catch {
    return 'No verified dashboard data is available. Set GEMINI_API_KEY to enable general AI guidance.';
  }
}
