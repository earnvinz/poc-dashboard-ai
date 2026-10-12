import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { getAnomalies, getDashboardSummary } from '../apps/mcp-server/data.ts';
import { parseDashboard, parseGroqText } from '../apps/gateway/ai.ts';

test('parses text from a Groq response', () => {
  assert.equal(parseGroqText({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Verified answer' }] }] }), 'Verified answer');
});

test('parses the AI dashboard response', () => {
  assert.deepEqual(parseDashboard({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"summary":{"month":"2026-09"},"anomalies":[]}' }] }] }), { summary: { month: '2026-09' }, anomalies: [] });
});

test('seeded September dashboard exposes a Bangkok revenue anomaly', () => {
  execFileSync(process.execPath, ['scripts/seed.ts']);
  const summary = getDashboardSummary({ month: '2026-09' });
  const anomalies = getAnomalies({ month: '2026-09' });
  assert.equal(summary.byBranch.length, 3);
  assert.equal(anomalies[0].branch, 'Bangkok');
  assert.ok(anomalies[0].changePercent <= -10);
});

test('gateway reads dashboard data through MCP tools', async () => {
  const start = (file: string) => spawn(process.execPath, [file], { stdio: 'inherit' });
  const mcp = start('apps/mcp-server/server.ts');
  const gateway = start('apps/gateway/server.ts');
  try {
    let lastResponse = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const response = await fetch('http://localhost:3000/api/dashboard?month=2026-09');
        lastResponse = `${response.status} ${await response.clone().text()}`;
        if (response.ok) {
          const body = await response.json();
          assert.equal(body.summary.month, '2026-09');
          assert.equal(body.anomalies[0].branch, 'Bangkok');
          return;
        }
      } catch (error) { lastResponse = error instanceof Error ? `${error.message}: ${error.cause instanceof Error ? error.cause.message : ''}` : 'Unknown error'; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail(`Gateway did not return dashboard data: ${lastResponse}`);
  } finally {
    mcp.kill();
    gateway.kill();
  }
});
