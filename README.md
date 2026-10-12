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

Open http://localhost:3000. The gateway asks the MCP server for trusted KPIs and anomalies; the frontend never reaches the database or MCP endpoint directly.

## Optional AI fallback

Copy `.env.example` to `.env`, then set a free Gemini API key to enable the Ask AI form and the fallback for months without dashboard data:

```bash
cp .env.example .env
npm run dev
```

Set `GEMINI_API_KEY=your_key` in `.env`. The default model is `gemini-3.1-flash-lite`; override it with `GEMINI_MODEL` if needed. For direct Remote MCP, set `MCP_REMOTE_URL` and a long `MCP_API_TOKEN`; Gemini can use only the allow-listed dashboard tools for the selected month. Keys stay server-side and are never sent to the browser.

## MCP tools

- `get_dashboard_summary({ month })`
- `get_revenue_by_branch({ month })`
- `get_revenue_anomalies({ month })`

The Gateway validates `month` as `YYYY-MM` and supplies that selected month to every tool call.
