# CLAUDE.md

Intelligent API Monitoring & Alert System, a technical interview task. `BUILD_SPEC.md` is the full spec. Build it one phase per prompt: finish that phase's "Done when" list, commit, then stop and summarise.

## Prompt logging (every prompt, no exceptions)

The task requires documenting every AI prompt. For **every** prompt the user gives in this project, fixes and small follow-ups included:

1. Append it to `prompts/AI_PROMPTS.md` under "Implementation prompts (Claude Code)" as `### Prompt N — <short title>`, numbering on from the last entry. Include the date and time, the phase, the prompt **verbatim** in a fenced block (use a longer fence if the prompt itself contains ```), and a 2–4 line **Outcome** of what you did.
2. Run `npm run prompts:docx` to regenerate `AI_Prompts.docx` in the project root.

Keep the "Runtime LLM prompt" section identical to the system prompt and user-message template in the backend's `services/llm/prompts.ts`. If `BUILD_SPEC.md` changes, update its copy in "Appendix A" too.

## Ground rules

- Windows 11, npm and Docker Desktop. Every npm script must be cross-platform: no `rm -rf` or bash-only syntax; use node scripts or cross-platform packages.
- Use official starters and CLIs instead of hand-writing boilerplate (create-vite, the shadcn CLI, `npm init`, `tsc --init`). If a CLI prompts, pass its non-interactive flags (check `--help`).
- Latest stable versions, TypeScript everywhere. The backend uses Express 5 and Mongoose.
- **Never create, read, print or commit a `.env` file.** Only `.env.example` files. Every config value has a safe default so the app runs with no `.env`; without `OPENAI_API_KEY` the LLM runs in template mode. The user creates `backend/.env` themselves.
- Git: commit at the end of every phase with a conventional commit message. Never add a remote or push.
- Clean, typed code in small focused files. Comments only where they explain *why*.

## Architecture rules

- npm workspaces: `backend/` (Express 5, TypeScript, ESM with NodeNext, so relative imports end in `.js`) and `frontend/` (Vite, React, TypeScript, Tailwind v4, shadcn/ui on Radix; `@` maps to `frontend/src`).
- Backend layers: routes → controllers → services → models. The detector (`services/detector.ts`) is pure, with no I/O.
- Rules detect anomalies; the LLM only writes the alert text. The LLM must never fail a batch: any failure falls back to the deterministic template for that item.
- One active alert per API (an incident), enforced by a partial unique index. Repeats increment `occurrences`; a healthy check auto-resolves the alert.
- Send only metrics to the LLM, never raw payloads (healthcare data).
- Routes have no `/api` prefix: `POST /monitor`, `GET /alerts`, `GET /apis/status`, `GET /health`.
- Frontend: typed API client in `src/lib/api.ts`, shared types in `src/types.ts`, TanStack Query hooks in `src/hooks/` (every query polls every 10 s). Add UI components with `npx shadcn@latest add <name>`, run inside `frontend/`.
- Severity is the only colour in the UI: the `healthy`, `warning` and `critical` tokens in `src/index.css`, always shown with an icon and a word.

## Toolchain notes (deliberate, do not "fix")

- The backend uses TypeScript 7; the frontend keeps the TypeScript ~6.0 pinned by create-vite.
- tsconfig `paths` are set without `baseUrl`, which TypeScript 6 deprecates and 7 removes.
- npm 12 blocks dependency install scripts. esbuild's is denied in the root `allowScripts`: its binary comes from `@esbuild/win32-x64` and works without it.
- Dark mode uses our own `ThemeProvider` (`src/components/theme-provider.tsx`), not next-themes, which renders a `<script>` that React 19 warns about in a client-only app. The shadcn `sonner.tsx` imports `useTheme` from `@/hooks/use-theme`.
- The Vite dev server is pinned to port 5173 (`strictPort`) because the backend's CORS allows exactly that origin.

## Commands (from the project root)

| Command | What it does |
|---|---|
| `npm install` | Installs every workspace |
| `npm run db:up` / `npm run db:down` | Starts / stops MongoDB 7 in Docker |
| `npm run dev` | Backend on http://localhost:4000, frontend on http://localhost:5173 |
| `npm run build` | Builds both workspaces |
| `npm test` | Runs the tests |
| `npm run monitor:file -- [path]` | Runs a JSON batch file through the monitor pipeline (default: `sample-data/sample-batch.json`) |
| `npm run prompts:docx` | Regenerates `AI_Prompts.docx` from `prompts/AI_PROMPTS.md` |
