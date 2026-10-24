# Video outline (about 9½ minutes)

Talking points and a click-by-click demo script, in the order the brief asks for.

## Before recording

1. Stop anything running, then start from an empty database:
   ```powershell
   npm run db:reset        # wipes local monitoring data and starts MongoDB
   npm run dev
   ```
2. Check that `backend/.env` has your `OPENAI_API_KEY`. The dashboard header should say **AI · gpt-4o-mini**.
3. Optional: set `EMAIL_ENABLED=true` in `backend/.env` to show the automatic digest email in the backend log.
4. Open http://localhost:5173 in a browser window at about 1280 px wide, and have the README open in another tab for the architecture diagram.
5. Keep a terminal visible beside the browser to show the backend log.

## 1. Architecture (1:30)

Show the README's architecture diagram.

- "This monitors the health of our healthcare APIs. It takes API results in two ways: `POST /monitor`, or a JSON file through `npm run monitor:file`. Both run the same batch pipeline."
- "The pipeline validates the batch, runs pure detection rules, updates incidents in MongoDB, and then asks the LLM to write the alert text."
- "The key idea: rules detect, AI explains. Detection is deterministic and unit-tested; the LLM only turns facts into a clear message, so it can't hide or invent an incident."
- "The backend is layered routes, controllers, services and models; the dashboard is React with TanStack Query polling every 10 seconds."

## 2. POST the sample batch (1:00)

- Point at the empty state: "Waiting for the first check" and "All monitored APIs are healthy".
- Click **Run a check**. "This is the sample from the task plus results that hit every rule: slow APIs, a 404, a 503, a redirect, empty, missing and malformed data, and one item without an `api_name`."
- Click **Submit batch**. Read the summary: 13 received, 12 processed, 1 skipped (index 12, `api_name` is missing), 3 healthy, 9 anomalies, 9 alerts created, 1 LLM call.
- "Only a missing `api_name` rejects an item. Everything else becomes an anomaly, and the rest of the batch keeps running."
- Optional: show the same thing from a terminal with `curl.exe` (the command is in the README).

## 3. Alerts appear with AI text (1:15)

- Close the panel. "The banner answers the first question: 3 critical incidents across 9 of 12 APIs."
- Walk through the AppointmentAPI card: the severity edge and badge, the AI-written title and message with the exact numbers, the likely cause and suggested action, the issue chips, and the metrics, where the ones that triggered the alert are marked.
- Point at the **AI** badge, then the header's **AI · gpt-4o-mini** badge. "Without a key, the same cards show template text, and the batch still works."
- Hover a chip in the API health strip to show its latest status, latency, records and check time.

## 4. POST it again to show dedupe (0:45)

- Open **Run a check**, click **Load sample**, then **Submit batch** again. The summary shows 0 created and 9 updated.
- "Still 9 alerts, each now marked ×2. There's one incident per API, enforced by a partial unique index in MongoDB, so it holds even for concurrent batches. And no new LLM calls: text is regenerated only when an alert's issues change or it gets worse."

## 5. Resolve an alert (0:30)

- Click **Resolve** on the BillingAPI card. "It leaves the list immediately (an optimistic update), the toast confirms, and the counts update."

## 6. The recovery batch auto-resolves the rest (0:45)

- **Run a check** → **Load recovery** → **Submit batch**. The summary shows 12 healthy and 8 auto-resolved.
- The banner turns green: "No active incidents".
- Open the **Resolved** tab: 8 were "auto-resolved when the API recovered" and 1 was "resolved by a user".

## 7. The email preview (1:00)

- Everything is healthy now, so first create something to report: **Run a check** → **Random batch** → **Submit batch**. It sends 50 random results, mostly healthy, with every kind of anomaly mixed in.
- Close the panel, click **Email report** in the header, then **Open preview** in the toast. Ethereal shows the email: a table of API, severity, AI message and suggested action.
- "Without SMTP settings, emails go to a free Ethereal test inbox, so this can be demoed without a mail server. With `EMAIL_ENABLED=true`, a digest is also sent automatically after any batch that opens or escalates critical alerts." If you turned it on, point at the digest's preview link in the backend log: one was sent after the first sample batch.
- "Email failures are logged and never break a batch."

## 8. Key decisions (1:30)

- **Rules detect, AI explains:** testable and trustworthy, and the LLM can never decide whether something is down.
- **One incident per API:** dedupe in the database, an occurrence count, and auto-resolve on recovery, so on-call engineers see incidents, not a flood of duplicates.
- **LLM batching and fallback:** one call for many alerts; strict JSON output at temperature 0.2 with a timeout and a retry; a per-alert template fallback, so the LLM can never fail a batch.
- **Privacy:** it's healthcare data, so only metrics go to the LLM, never payloads.
- **Production basics:** validated config with safe defaults, pino logs with request IDs, one error format, rate limits, graceful shutdown, and 96 tests (`npm test`).

## 9. Scaling (1:00)

- "To monitor thousands of APIs: put batches on a queue such as BullMQ and process them with workers, keeping each API's results in order."
- "The API instances are stateless, so they scale horizontally behind a load balancer, with rate limits shared through Redis."
- "MongoDB is indexed for the hot queries, and a TTL index drops old checks after 30 days. Next would be a latest-status collection, a replica set and sharding by API."
- "For the LLM: rate limits, caching text for repeated incidents, and a circuit breaker that switches to templates when OpenAI is slow."

## Close (0:15)

- "Every AI prompt I used, and the runtime prompt the app sends, is in `AI_Prompts.docx` in the repo root."
