# InterviewOS

InterviewOS is an AI interview coach for software engineering interview prep. The MVP focuses on system design practice while keeping behavioral and coding explanation modes in the same product shape.

Live demo: https://interviewos-two.vercel.app

Built with Next.js, TypeScript, Supabase, OpenAI structured-output integration,
and a deterministic local agent fallback for no-cost public demos.

## What is built

- Dashboard with streak, sessions completed, average score, weak areas, recommendations, and recent sessions.
- Mock interview console with System Design, Behavioral, and Coding Explanation modes.
- Adaptive follow-up loop that maintains session state.
- Structured rubric evaluation with overall score, dimension scores, strengths, improvement areas, drills, and follow-up questions.
- Progress view with score trend, weak tags, history, and filters.
- Settings view for rubric weights, focus areas, target role/company, and AI model placeholder.
- Local eval harness for quality checks.
- Supabase persistence for sessions, messages, evaluations, rubric scores, profile settings, and rubric weights.
- Progress-aware coaching that uses saved weak areas to target future follow-ups.
- OpenAI integration point without requiring credentials for local demo use.

## Architecture

The first MVP is intentionally simple:

- `src/app/(workspace)` contains the route-based product pages.
- `src/components/interviewos/app-shell.tsx` owns the sidebar workspace shell.
- `src/components/interviewos/provider.tsx` owns temporary client-side session state and user actions.
- `src/components/interviewos/pages/*` contains focused page-level UI.
- `src/lib/interview/types.ts` defines the core product data model.
- `src/lib/interview/catalog.ts` stores prompts, rubric defaults, seed sessions, and demo progress data.
- `src/lib/interview/progress-memory.ts` summarizes saved history for the coach.
- `src/lib/interview/agent.ts` is a deterministic local coach used for demos, fallback behavior, and evals.
- `src/lib/interview/openai-agent.ts` calls OpenAI structured outputs when `OPENAI_API_KEY` is present.
- `src/lib/supabase.ts` owns Supabase auth, profile, session, and evaluation persistence.
- `src/app/api/interview/turn/route.ts` is the backend boundary for the interview agent.
- `scripts/run-evals.ts` checks the local agent behavior against small regression cases.

This gives a clear interview story: the UI sends the transcript and session settings to a backend route, the route decides whether to ask a follow-up or evaluate, and the response is validated against a structured schema before the UI updates.

For a guided walkthrough of the important files and agent actions, read `docs/CODEBASE_NOTES.md`.
For the public demo checklist and environment modes, read `docs/DEPLOYMENT.md`.

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Optional environment variables:

```bash
cp .env.example .env.local
```

With no API key, the app uses the local deterministic coach. With `OPENAI_API_KEY`, the API route attempts OpenAI structured output first and falls back locally if the call fails.

## Quality checks

Codex can run the static and agent checks in restricted environments:

```bash
npm run check
```

Check which demo mode your current environment will use:

```bash
npm run demo:check
```

Full local or CI validation runs the browser flow too:

```bash
npx playwright install chromium
npm run quality
```

`npm run test:e2e` starts the app on port `3100` with
`INTERVIEWOS_AGENT_SOURCE=local`, so the flow is deterministic even when an
OpenAI key is present.

GitHub Actions runs the full quality gate on pushes to `main` and pull requests.

Before deploying a resume demo, run:

```bash
npm run deploy:check
```

That stricter check expects Supabase env vars because deployed users should be
able to save sessions.

## Supabase persistence

The schema migrations live in:

```bash
supabase/migrations/20260601130000_initial_interviewos_schema.sql
supabase/migrations/20260601204500_allow_zero_rubric_scores.sql
supabase/migrations/20260601211500_add_profile_rubric_weights.sql
supabase/migrations/20260601224500_add_abandoned_session_status.sql
```

It creates:

- `profiles`
- `interview_sessions`
- `interview_messages`
- `evaluations`
- `rubric_scores`
- `practice_goals`

For the demo path, enable anonymous sign-ins in Supabase Auth and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

With those values present, the app syncs new sessions, transcript messages, evaluations, rubric scores, profile settings, and saved rubric weights. Without them, it keeps using local demo data.

Session lifecycle is explicit: `active` attempts can become `evaluated` when the
coach scores them, or `abandoned` when the user discards/replaces them. Abandoned
sessions are preserved in storage but do not count as completed practice.

## Lovable import workflow

Treat the Lovable output as a visual sketch. After import:

1. Move reusable UI into focused components.
2. Preserve the data model in `src/lib/interview/types.ts`.
3. Keep agent calls behind `src/app/api/interview/turn/route.ts`.
4. Add or update eval cases when behavior changes.
5. Keep Supabase persistence behind `src/lib/supabase.ts` so UI pages stay database-agnostic.
