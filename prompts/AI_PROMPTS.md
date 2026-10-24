# AI Prompts — Intelligent API Monitoring & Alert System

**Author:** Syed Raihan Ali

**Date:** 24 October 2026

This document records every AI prompt used to plan and build this project, in the order they were given. Prompts are quoted verbatim, typos included.

## Tools used

- **Claude (claude.ai)** for analysing the task, planning, and writing BUILD_SPEC.md
- **Claude Code** for implementation
- **The OpenAI API** at runtime, to write the alert text (model set by `OPENAI_MODEL`)

## Planning prompts (claude.ai)

### Prompt P1 — Analyse the task and brainstorm

Sent with the task PDF attached.

```
check this entire document let me know what to do here?
i have about 1 day left, what to do, first brain strom it
```

**Outcome:** Claude summarised the requirements and proposed the architecture (rules detect anomalies, the LLM explains them, deduplication, template fallback), the stack, and a 24-hour plan.

### Prompt P2 — Hand the build to Claude Code

```
okay, i am basically want to give everything to claude code and it should do it for me,  i will make the video, each prompt will be documented in docx in root of the project,
i have npm installed on my windows 11 pc, docker also installed, for llm,i have openai key, a small one i think better,
git remote later i will do later, leave .env out,
do not write everything from scratch, but use npm scripts, like starter official templates,

project keep it in g: projects folder,
```

**Outcome:** Claude wrote BUILD_SPEC.md (Appendix A) and the phase-by-phase prompts for Claude Code.

## Implementation prompts (Claude Code)

Every prompt given to Claude Code in this repository, in order. Claude Code appends each new prompt here and regenerates this document with `npm run prompts:docx`.

### Prompt 1 — Phase 1: Scaffold

- **Date and time:** 2026-10-24 18:11 (UTC+06:00)
- **Phase:** 1 — Scaffold

```
Read BUILD_SPEC.md carefully. Do Phase 1 (Scaffold) only. Follow the prompt logging rules from section 2, starting with this prompt. When Phase 1's "Done when" list passes, commit and give me a short summary.
Read BUILD_SPEC.md carefully. Do Phase 1 (Scaffold) only. Follow the prompt logging rules from section 2, starting with this prompt. When Phase 1's "Done when" list passes, commit and give me a short summary.
```

**Outcome:**

- Scaffolded the npm-workspaces monorepo: an Express 5 + TypeScript backend with `GET /health`, and a Vite + React + TypeScript frontend with Tailwind CSS v4 and shadcn/ui (Radix, Nova preset).
- Added `docker-compose.yml` (MongoDB 7 with a named volume and a healthcheck), sample batches that cover every detection rule, CLAUDE.md, this prompt log and its docx generator.
- Verified `npm install`, `npm run db:up`, `npm run dev`, `/health`, both builds and `npm run prompts:docx`, then committed.

### Prompt 2 — Rename the branch, start Phase 2

- **Date and time:** 2026-10-24 19:19 (UTC+06:00)
- **Phase:** 2 — Backend

```
rename the branch from master to main, and lets start the phase 2,
```

**Outcome:**

- Interrupted by the user before any work started; Prompt 3 replaced it.
- The branch rename it asked for was done as part of Prompt 3: `master` is now `main`.

### Prompt 3 — Phase 2: Backend

- **Date and time:** 2026-10-24 19:19 (UTC+06:00)
- **Phase:** 2 — Backend

```
Do Phase 2 (Backend) from BUILD_SPEC.md. Log this prompt. Run every check in the "Done when" list yourself (template mode is fine, there is no API key yet), commit, and summarize.
```

**Outcome:**

- Built the layered Express 5 backend: a pure detector with per-API thresholds, one incident per API (deduped by a partial unique index, auto-resolved on recovery), a concurrent batch pipeline, and an LLM alert writer with template fallback.
- Added every endpoint, pino logging, central error handling, graceful shutdown, `backend/.env.example` and the `npm run monitor:file` CLI.
- Verified in template mode with 86 scripted checks (counts, dedupe, auto-resolve, filters, errors, concurrency, rate limit), and the AI path against a local mock of the OpenAI API (23 checks).
- Documented the runtime LLM prompt below, renamed the branch to `main`, and committed.

## Runtime LLM prompt

The backend sends this to the OpenAI Chat Completions API for every alert that needs text (`backend/src/services/llm/prompts.ts`):

- **Model:** `OPENAI_MODEL` (default `gpt-4o-mini`), temperature 0.2, timeout `LLM_TIMEOUT_MS` with 1 retry
- **Output:** structured outputs with a strict JSON schema named `alert_texts`: an `alerts` array of `{ id, title, message, likelyCause, suggestedAction }`
- **Batching:** one call per `LLM_BATCH_SIZE` alerts (default 20)
- **Privacy:** only the fields in the user message below are sent, never raw payloads
- **Fallback:** any alert the LLM misses, or returns invalid, gets the deterministic template text instead

### System prompt

```
You are an SRE assistant on the integration team of a healthcare company. You write the alerts that on-call engineers read when one of the company's APIs misbehaves.

The input is a JSON object with a list of alerts. Each alert has an id, the API name, its severity (warning or critical), occurrences (how many anomalous checks the incident has had so far), the detected issues, the latest metrics, and the thresholds the metrics were checked against. A metric is null when the monitoring data had no valid value for it.

For each alert, write:
- title: at most 8 words. Name the API and the main problem.
- message: 1 or 2 sentences, at most 40 words. Name the API, say what went wrong, and give the key numbers exactly as provided (status code, response time in ms, records returned).
- likelyCause: one sentence on the most likely cause.
- suggestedAction: one or two concrete steps the on-call engineer can take now, such as checking the upstream provider's status page, inspecting the API's server logs, verifying query filters or pagination, or checking the database connection pool.

Rules:
- Use only the facts in the input. Never invent numbers, error messages, times or events.
- Copy numbers exactly as given. Do not round them or change their units.
- Never state a cause as certain: say "likely" or "possible".
- Match the tone to the severity: critical alerts are urgent and direct; warnings are calm and factual.
- If occurrences is greater than 1, say that the problem is recurring.
- Write plain English: no markdown, emoji or bullet points.
- Return exactly one alert for each input alert, with the same id.
```

### User message template

`{{input}}` is replaced by the alerts as compact JSON.

```
Write the alerts for this input:

{{input}}
```

Example `{{input}}` for the task's AppointmentAPI result (pretty-printed here):

```json
{
  "alerts": [
    {
      "id": "6650f0c2a1b2c3d4e5f60718",
      "apiName": "AppointmentAPI",
      "severity": "critical",
      "occurrences": 1,
      "issues": [
        {
          "type": "SERVER_ERROR",
          "severity": "critical",
          "detail": "HTTP 500 server error"
        },
        {
          "type": "HIGH_LATENCY",
          "severity": "critical",
          "detail": "Response time 5500 ms is above the 5000 ms critical threshold"
        },
        {
          "type": "EMPTY_DATA",
          "severity": "warning",
          "detail": "Returned 0 records"
        }
      ],
      "metrics": {
        "statusCode": 500,
        "responseTimeMs": 5500,
        "recordsReturned": 0
      },
      "thresholds": {
        "latencyWarningMs": 2000,
        "latencyCriticalMs": 5000,
        "expectRecords": true
      }
    }
  ]
}
```

## Appendix A — BUILD_SPEC.md

The full build spec, written with Claude (claude.ai) from the task PDF. It is effectively the main prompt for Claude Code.

````markdown
# BUILD_SPEC — Intelligent API Monitoring & Alert System

> Build spec for Claude Code. Written with Claude (claude.ai) from the interview task PDF and my requirements.
> Build it in 4 phases, **one phase per prompt**. Finish the phase's "Done when" list, commit, then stop and summarize.

---

## 0. Context

This is a technical interview task. It is evaluated on: clean and modular backend and API design, a user-friendly UI, the quality of the AI-generated alerts, proper anomaly storage, correct detection logic, and scalability across many APIs.

Deliverables: a GitHub repo (I will add the remote and push later), a README with setup and run instructions, a 5–10 min video (I record it myself), and **AI_Prompts.docx** documenting every AI prompt used.

### Original task requirements (all must be met)

- **Input methods:** (1) a static JSON file of API responses, (2) `POST /monitor` on the Node.js backend. Example input:

```json
[
  { "api_name": "PatientDataAPI", "response_time_ms": 1200, "status_code": 200, "records_returned": 50 },
  { "api_name": "AppointmentAPI", "response_time_ms": 5500, "status_code": 500, "records_returned": 0 }
]
```

- **Health monitoring:** evaluate response time, check HTTP status codes, validate returned data.
- **Anomaly detection:** high response time, failed requests (e.g. 500), missing or zero records.
- **AI alerts:** use an LLM API to write human-readable alerts, e.g. *"AppointmentAPI failed with status 500 and returned 0 records. Possible outage or data issue."*
- **Storage:** store detected anomalies in a database (MongoDB).
- **API:** `GET /alerts` returns all **active** anomalies.
- **Frontend:** a clean, user-friendly UI that displays alerts.
- **Optional:** send anomaly reports by email.
- **Technical:** Node.js + Express, modular and scalable architecture, batch processing of many API inputs, proper error handling, a logging system.

---

## 1. Environment and ground rules

- **Machine:** Windows 11, npm, Docker Desktop. The project root is the current folder (`G:\projects\api-monitor`). Every npm script must be cross-platform: no `rm -rf` and no bash-only syntax. Use node scripts or cross-platform packages instead.
- **Use official starters and CLIs instead of hand-writing boilerplate:**
  - `npm create vite@latest` with the `react-ts` template
  - Tailwind CSS v4 via `@tailwindcss/vite`, following the official Tailwind and shadcn/ui Vite guides
  - `npx shadcn@latest init` and `npx shadcn@latest add ...` for UI components
  - `npm init -y` and `npx tsc --init` for the backend
  - If a CLI asks interactive questions, use its non-interactive flags (check `--help`) instead of hanging.
- Use the latest stable versions, with TypeScript everywhere. The backend uses Express 5 and Mongoose.
- **.env files:** NEVER create, read, print or commit any `.env` file. Only create `.env.example` files. Every config value needs a safe default, so the app runs with no `.env` at all. Without an API key, the LLM falls back to template mode. I will create `backend/.env` with my OpenAI key myself.
- **Git:** run `git init` in Phase 1. Commit at the end of every phase with a clear conventional commit message. Do **not** add a remote or push.
- Keep the code clean and typed, with small focused files. Add comments only where they explain *why*.

---

## 2. Prompt logging (applies to EVERY prompt, including the first one)

The task requires documenting every AI prompt. For **every** prompt I give you in this project (fixes and small follow-ups included):

1. Append it **verbatim** to `prompts/AI_PROMPTS.md` under "Implementation prompts (Claude Code)", as `### Prompt N — <short title>`. Include the date and time, the phase, the prompt exactly as I typed it in a fenced block, and a 2–4 line **Outcome** summary of what you did.
2. Run `npm run prompts:docx` to regenerate `AI_Prompts.docx` in the project root.

Put this rule in `CLAUDE.md` so it survives between sessions.

### `prompts/AI_PROMPTS.md` structure (create it in Phase 1)

1. **Title:** "AI Prompts — Intelligent API Monitoring & Alert System", author **Syed Raihan Ali**, and the date.
2. **Tools used:**
   - Claude (claude.ai) for analysing the task, planning, and writing BUILD_SPEC.md
   - Claude Code for implementation
   - The OpenAI API at runtime, to write the alert text (model set by `OPENAI_MODEL`)
3. **Planning prompts (claude.ai):** the two prompts below, verbatim, each with its one-line outcome.
4. **Implementation prompts (Claude Code):** filled in as we go.
5. **Runtime LLM prompt:** the exact system prompt and user-message template the app sends to the LLM. Fill this in during Phase 2 and keep it in sync with the code.
6. **Appendix A — BUILD_SPEC.md:** the full contents of this file, since it is effectively the main prompt.

### Planning prompts (verbatim, typos kept)

**Prompt P1** (sent with the task PDF attached):

```
check this entire document let me know what to do here?
i have about 1 day left, what to do, first brain strom it
```

Outcome: Claude summarised the requirements and proposed the architecture (rules detect anomalies, the LLM explains them, deduplication, template fallback), the stack, and a 24-hour plan.

**Prompt P2:**

```
okay, i am basically want to give everything to claude code and it should do it for me,  i will make the video, each prompt will be documented in docx in root of the project,
i have npm installed on my windows 11 pc, docker also installed, for llm,i have openai key, a small one i think better,
git remote later i will do later, leave .env out,
do not write everything from scratch, but use npm scripts, like starter official templates,

project keep it in g: projects folder,
```

Outcome: Claude wrote this BUILD_SPEC.md and the phase-by-phase prompts for Claude Code.

### Docx generator

`scripts/build-prompts-docx.mjs` lives in the root and uses the `docx` npm package as a root devDependency. It converts `prompts/AI_PROMPTS.md` into `AI_Prompts.docx`. It must handle:

- `#`, `##` and `###` headings
- paragraphs and bullet lists
- **bold** text
- fenced code blocks, rendered in a monospace font (e.g. Consolas) with light grey shading and line breaks preserved

Add a root script `"prompts:docx"` that runs it.

---

## 3. Target structure

```
api-monitor/
├─ backend/                 Express 5 + TypeScript API
├─ frontend/                Vite + React + TS + Tailwind v4 + shadcn/ui
├─ sample-data/             JSON batches for file input and the demo
├─ prompts/AI_PROMPTS.md
├─ scripts/build-prompts-docx.mjs
├─ docs/video-outline.md    (Phase 4)
├─ docker-compose.yml       MongoDB
├─ AI_Prompts.docx
├─ BUILD_SPEC.md  CLAUDE.md  README.md
└─ package.json             npm workspaces + root scripts
```

### Root scripts

| Script | What it does |
|---|---|
| `dev` | Runs backend and frontend together (via `concurrently`) |
| `build` | Builds both |
| `test` | Runs the tests |
| `db:up` / `db:down` | Starts / stops MongoDB with docker compose |
| `monitor:file` | Processes a JSON file (default: `sample-data/sample-batch.json`) |
| `prompts:docx` | Regenerates `AI_Prompts.docx` |

---

## 4. Phase 1 — Scaffold

- **Root:** `package.json` with workspaces `[backend, frontend]`, and a root `.gitignore` covering `node_modules`, `dist`, `.env`, `.env.*`, `!.env.example`, `logs/` and `coverage`. Run `git init`.
- **docker-compose.yml:** `mongo:7` on port 27017, with a named volume and a healthcheck.
- **Backend skeleton:**
  - `npm init -y` and a TypeScript config (ESM, NodeNext, strict)
  - dependencies installed (see Phase 2)
  - scripts: `dev` (tsx watch), `build` (tsc), `start` (node dist)
  - a minimal app with `GET /health` so it boots
- **Frontend:** create-vite `react-ts`, then Tailwind v4, then shadcn init (alias `@` → `src`). Confirm that `npm run dev` works.
- **Sample data:** the files described in §7.
- **CLAUDE.md:** short project rules — a summary of §1 and §2, the architecture rules, and the main commands.
- **Prompt log:** `prompts/AI_PROMPTS.md`, the docx script, and a first generated `AI_Prompts.docx`.

**Done when:**
- `npm install` works at the root
- `npm run db:up` starts Mongo
- `npm run dev` starts both apps
- `/health` responds
- `AI_Prompts.docx` exists
- everything is committed

---

## 5. Phase 2 — Backend

### Architecture

The backend is layered: **routes → controllers → services → models**. Detection is a **pure** module with no I/O, so it is easy to unit-test. Suggested layout:

```
backend/src/
  server.ts                 start/stop, graceful shutdown
  app.ts                    express app (exported for tests)
  config/env.ts             zod-validated env with defaults
  config/thresholds.ts      default + per-API rules
  lib/logger.ts             pino
  lib/errors.ts             AppError + helpers
  db/mongoose.ts
  models/                   alert.model.ts, apiCheck.model.ts, monitorRun.model.ts
  modules/monitor/          routes, controller, service (batch pipeline), schema
  modules/alerts/           routes, controller, service, schema
  modules/apis/             GET /apis/status
  services/detector.ts
  services/llm/             alertWriter.ts, prompts.ts, templateAlert.ts
  services/notifier/        email.ts (Phase 4)
  middleware/               request id + pino-http, validate, notFound, errorHandler, rateLimit
  cli/monitorFile.ts
```

**Dependencies:** express, mongoose, zod, openai, pino, pino-http, helmet, cors, express-rate-limit, p-limit, dotenv, and nodemailer (used in Phase 4).
**Dev dependencies:** typescript, tsx, pino-pretty, vitest, and the needed `@types/*` packages.

### Env (`backend/.env.example` — every value is optional)

```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/api_monitor
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=15000
LLM_BATCH_SIZE=20
AUTO_RESOLVE_ON_RECOVERY=true
MAX_BATCH_SIZE=1000
EMAIL_ENABLED=false
EMAIL_TO=
EMAIL_FROM=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### Input validation

- The body may be a single object or an array; normalize it to an array.
- An empty array returns 400. More than `MAX_BATCH_SIZE` items returns 413.
- An item is **rejected** only when `api_name` is missing or is not a non-empty string. It is listed in `invalid` with its index and the reason, and the rest of the batch continues.
- Every other problem is an **anomaly**, not a validation error:
  - `status_code` missing, or not an integer from 100 to 599 → `INVALID_DATA`
  - `response_time_ms` missing, not a number, or negative → `INVALID_DATA`
  - `records_returned` missing or null → `MISSING_DATA`
  - `records_returned` not an integer, or negative → `INVALID_DATA`
- Extra fields are accepted and ignored.
- If every item is invalid, return 400 with the details.

### Detection rules (`services/detector.ts`, pure)

| Issue type | Condition | Severity |
|---|---|---|
| SERVER_ERROR | status ≥ 500 | critical |
| CLIENT_ERROR | status 400–499 | warning |
| UNEXPECTED_STATUS | status 1xx or 3xx | warning |
| HIGH_LATENCY | time > latencyWarningMs (default 2000) | warning |
| HIGH_LATENCY | time > latencyCriticalMs (default 5000) | critical |
| EMPTY_DATA | `records_returned === 0` and expectRecords is true | warning |
| MISSING_DATA | records missing or null | warning |
| INVALID_DATA | any malformed field | warning |

- The **overall severity** is the highest issue severity. A check with no issues is healthy.
- `thresholds.ts` holds the defaults `{ latencyWarningMs: 2000, latencyCriticalMs: 5000, expectRecords: true }` plus a per-API overrides map. Examples: tighter latency limits for PatientDataAPI, and a HealthCheckAPI with `expectRecords: false`.
- The detector returns `{ apiName, healthy, severity, issues: [{ type, severity, detail }], metrics }`.

### Alert lifecycle (one active alert per API = one "incident")

**Alert document fields:** apiName, status (`active` | `resolved`), severity, issues[], title, message, likelyCause, suggestedAction, aiGenerated (bool), aiModel, lastMetrics, occurrences, firstSeen, lastSeen, resolvedAt, resolvedBy (`user` | `auto-recovery`), and timestamps.

**Indexes:**
- a partial unique index on `apiName` where `status = 'active'`, which prevents duplicates even when batches run concurrently
- indexes on `status + severity` and on `lastSeen`

**Behaviour for each check:**

| Check result | Existing active alert? | What happens |
|---|---|---|
| Anomalous | No | Create a new alert (it needs AI text). |
| Anomalous | Yes | `occurrences++` and update lastSeen, lastMetrics and issues. Regenerate the AI text **only** if the set of issue types changed or the severity escalated, to save LLM calls. Otherwise keep the message. |
| Healthy | Yes, and `AUTO_RESOLVE_ON_RECOVERY` is on | Resolve it with `resolvedBy: 'auto-recovery'`. |

**Batch handling:**
- If the same API appears several times in one batch, process its items in input order. Group items by apiName and process the groups concurrently with p-limit.
- Save one **ApiCheck** document per processed item: apiName, metrics, healthy, severity, issue types, runId, checkedAt. It has a 30-day TTL and an index on `apiName + checkedAt`.
- Save one **MonitorRun** document per batch: source (`api` | `file`), counts, durationMs, and LLM stats.

### LLM alert writer

- **Setup:** use the official `openai` SDK, with the model taken from `OPENAI_MODEL`. Use structured outputs with a strict JSON schema. If the SDK's zod helper doesn't work with the installed zod version, pass a plain JSON schema instead.
- **Batching:** send every alert that needs text in one call per chunk of `LLM_BATCH_SIZE`.
  - Input per item: id, apiName, severity, issues, metrics, thresholds, occurrences.
  - Output per item: id, title (≤ 8 words), message (1–2 sentences, ≤ 40 words), likelyCause, suggestedAction.
- **Privacy:** send only these metrics and never raw payloads, because this is healthcare data. Mention this in the README.
- **Reliability:** use a low temperature (0.2), a timeout of `LLM_TIMEOUT_MS`, and 1 retry. Validate the response.
  - If an item is missing or invalid, or the call fails, use the deterministic template for that item (`aiGenerated: false`) and log a warning.
  - With no API key, run in template mode and log that once at startup.
  - **The batch must never fail because of the LLM.**
- **Template example:** "AppointmentAPI failed with status 500 and returned 0 records (5500 ms). Possible outage or data issue."
- **System prompt** (`services/llm/prompts.ts`): write a strong one.
  - Role: an SRE assistant for a healthcare company's integration team, writing alerts for on-call engineers.
  - Use only the facts given. Never invent numbers, and never state a cause as certain (use "likely" or "possible").
  - Always name the API and give the key numbers exactly as provided.
  - Match the tone to the severity; critical alerts sound urgent.
  - `suggestedAction` must be concrete, e.g. check the upstream status page, inspect server logs, verify query filters or pagination, check the DB connection pool.
  - Plain English, no markdown.
  - Copy the final prompt into the "Runtime LLM prompt" section of AI_PROMPTS.md.

### Endpoints

The task uses `/monitor` and `/alerts`, so there is no `/api` prefix.

| Method and path | Behaviour |
|---|---|
| `POST /monitor` | Rate limited. Returns 200 with `{ runId, received, processed, invalid: [{ index, reason }], healthy, anomalies, alerts: { created, updated, autoResolved }, llm: { mode: 'ai' \| 'template', calls, fallbacks }, durationMs, results: [{ apiName, healthy, severity, issues }] }`. |
| `GET /alerts` | Returns active alerts by default, sorted by severity, then lastSeen descending. Query params: `status=active\|resolved\|all`, `severity`, `apiName` (case-insensitive contains), `limit` (default 100, max 500), `page`. Response: `{ data, total, page, limit }`. |
| `GET /alerts/stats` | `{ active, critical, warning, apisAffected, resolvedLast24h, checksLast24h }` |
| `GET /alerts/:id` | One alert. |
| `PATCH /alerts/:id/resolve` | Idempotent. 404 if not found, 400 for an invalid ObjectId. |
| `GET /apis/status` | The latest check per API (aggregation), with healthy/severity and whether an active alert exists. |
| `GET /health` | `{ status, db: 'up' \| 'down', llm: 'ai' \| 'template', model, uptimeSec }` |

### Cross-cutting concerns

- **Logging:**
  - pino: pretty output in dev, JSON in production, and a copy written to `logs/app.log` (multi-transport)
  - pino-http with a request id (`X-Request-Id`), with auth headers redacted
  - log each batch summary, LLM latency/tokens/fallbacks, auto-resolves, and the startup config (without secrets)
- **Errors:**
  - an `AppError(status, code, message, details)` class
  - zod errors → 400 `VALIDATION_ERROR`; unknown routes → 404 `NOT_FOUND`; malformed JSON → 400 `INVALID_JSON`
  - a central handler that returns `{ error: { code, message, details?, requestId } }` and hides stacks in production
  - log `unhandledRejection` and `uncaughtException` at process level
  - graceful shutdown that closes the server and mongoose
  - if Mongo is unreachable at startup, log a clear hint ("run npm run db:up") and exit with a non-zero code
- **Security basics:** helmet, cors (`CORS_ORIGIN`), and `express.json` limited to 1mb.
- **File input CLI:** `npm run monitor:file -- <path>` reads a JSON file and runs the **same pipeline** as `POST /monitor` (with source `file`), then prints a readable summary table. This is input method #1.

**Done when:**
- the build passes
- with the server running, `POST`ing `sample-batch.json` returns the correct counts
- `GET /alerts` shows the expected alerts
- posting the same file again increments `occurrences` instead of creating duplicates
- `recovery-batch.json` auto-resolves the alerts
- everything works with no OpenAI key (template mode); I will test AI mode myself after adding the key
- the Runtime LLM prompt is documented
- everything is committed

---

## 6. Phase 3 — Frontend

**Stack:** Vite + React + TS + Tailwind v4 + shadcn/ui, TanStack Query (for polling), lucide-react, date-fns, and sonner toasts. `VITE_API_URL` (default `http://localhost:4000`) goes in `frontend/.env.example`. Put a typed API client in `src/lib/api.ts` and the types in `src/types.ts`.

Build a single-page dashboard that is clean and professional (think Linear or Vercel status pages), responsive, and has a light/dark toggle.

- **Header:** app name, a backend health dot (DB up/down), an LLM mode badge ("AI · gpt-4o-mini" or "Template mode"), the last-updated time, and a manual refresh button.
- **Stat cards:** Active alerts, Critical, Warnings, APIs affected (from `/alerts/stats`).
- **API health strip:** one chip per API from `/apis/status`, coloured green, amber or red. The tooltip shows the last status, latency, records, and how long ago it was checked.
- **Alerts section:**
  - Tabs: Active / Resolved / All. Filters: a severity select and an API-name search.
  - Each alert card has:
    - a severity colour accent and badge
    - the API name and the title
    - the AI message, shown prominently
    - the likely cause and the suggested action
    - issue chips and a metrics row (status, latency, records)
    - the occurrence count ("×3") and first/last seen as relative times
    - an "AI" or "Template" badge
    - a Resolve button with an optimistic update and a toast
  - Resolved alerts show who or what resolved them.
- **"Run a check" panel (Sheet or Dialog):**
  - a textarea prefilled with the sample JSON
  - buttons: Load sample / Load recovery / Random batch (generates 50 random API results client-side) / Submit
  - Submit sends the batch to `POST /monitor`, then shows a result summary (processed, anomalies, created/updated/auto-resolved, invalid items, LLM mode, duration) and refreshes the data.
- **States:** poll every 10s, show loading skeletons, a friendly error state when the backend is down ("Start the backend with npm run dev"), and an empty state ("All monitored APIs are healthy").

**Done when:**
- the build passes
- the full flow works in the browser against the backend: submit the sample → alerts appear → resolve one → the recovery batch auto-resolves the rest
- everything is committed

---

## 7. Sample data (`sample-data/`)

Use healthcare-flavoured API names.

**`sample-batch.json`:** the two items from the task, plus about 8 more that cover every rule:
- PatientDataAPI, healthy
- BillingAPI, slow at about 3200 ms (warning)
- InventoryAPI, about 7000 ms (critical)
- LabResultsAPI, status 200 with 0 records
- PrescriptionAPI, with `records_returned` missing
- InsuranceAPI, status 404
- AuthAPI, status 503
- DoctorScheduleAPI, healthy
- one item with no `api_name` (to demo validation)

**`recovery-batch.json`:** the same APIs, all healthy, to demo auto-resolve.

---

## 8. Phase 4 — Email, tests, docs, final check

- **Email (the optional feature)** with nodemailer:
  - After a batch, if `EMAIL_ENABLED` is on and there are new or escalated critical alerts, send **one** digest email. It holds an HTML table with the API, severity, AI message and suggested action.
  - Add `POST /alerts/report/email`, which sends a report of all active alerts on demand, plus an "Email report" button in the UI.
  - If SMTP isn't configured, use a nodemailer Ethereal test account and log and return the preview URL, so the feature can be demoed.
  - Email failures are logged and never break the batch.
- **Tests (Vitest):**
  - the detector: each rule, combinations, thresholds, and per-API overrides
  - input normalization and validation
  - the alert writer's fallback when the OpenAI call throws or returns malformed data (mock the client)
  - root `npm test` runs them all
- **README.md:**
  - overview, features, and an architecture diagram (Mermaid)
  - key design decisions: rules detect and AI explains; one incident per API with dedupe; auto-resolve; LLM batching and fallback; privacy
  - tech stack and prerequisites
  - setup and run, Windows-friendly: `npm install`, `npm run db:up`, copy `.env.example` → `.env` and optionally add `OPENAI_API_KEY`, `npm run dev`, and the URLs to open
  - a table of npm scripts
  - an API reference with curl examples (note that in PowerShell you use `curl.exe`)
  - sample data and file input, testing, and logging
  - a scaling plan: a queue (e.g. BullMQ) with workers, horizontal API instances, Mongo indexes and TTL, LLM rate limiting and caching
  - project structure, and AI usage → AI_Prompts.docx
- **`docs/video-outline.md`:** 5–10 minutes of talking points plus a demo script, in this order:
  1. architecture
  2. POST the sample batch
  3. alerts appear with AI text
  4. POST it again to show dedupe
  5. resolve an alert
  6. the recovery batch auto-resolves the rest
  7. the email preview
  8. key decisions
  9. scaling
- **Final verification from a clean state:** run `npm run build` and `npm test`, start everything, run the demo flow end to end, regenerate `AI_Prompts.docx`, and commit. Report anything that needs my action, such as adding the OpenAI key.
````
