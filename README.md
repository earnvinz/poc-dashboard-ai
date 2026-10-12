# AI Dashboard MCP POC

```text
Frontend → Gateway (allow-list + request schema) → MCP tools → SQLite gold data
```

## Run

```bash
npm run seed
npm run typecheck
npm run dev
```

Open http://localhost:3000. Groq calls the trusted MCP tools for both the dashboard and Ask AI flows; the frontend never reaches the database or MCP endpoint directly.

## Groq Remote MCP

Copy `.env.example` to `.env`, then set a Groq API key to enable the AI dashboard and Ask AI form:

```bash
cp .env.example .env
npm run dev
```

Set `GROQ_API_KEY=your_key` in `.env`. The default model is `openai/gpt-oss-20b`; override it with `GROQ_MODEL` if needed. For direct Remote MCP, set `MCP_REMOTE_URL` and a long `MCP_API_TOKEN`; Groq can use only the allow-listed dashboard tools for the selected month. Keys stay server-side and are never sent to the browser.

## MCP tools

- `get_dashboard_summary({ month })`
- `get_revenue_by_branch({ month })`
- `get_revenue_anomalies({ month })`

The Gateway validates `month` as `YYYY-MM` and supplies that selected month to every tool call.
