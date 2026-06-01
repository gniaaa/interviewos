# InterviewOS Deployment Notes

Use this checklist before sharing a public demo link.

## Demo Modes

InterviewOS has two agent modes:

- Local deterministic agent: no external model call, stable behavior, no API cost.
- OpenAI structured output: calls OpenAI first, validates the structured response,
  then falls back to the local agent if the call fails or returns invalid output.

For a resume demo, start with deterministic mode:

```bash
INTERVIEWOS_AGENT_SOURCE=local
```

That lets reviewers use the app without spending OpenAI quota. You can still
show the OpenAI path in code and turn it on later by setting `OPENAI_API_KEY`.

## Required Vercel Environment

Set these for a deployed demo that saves sessions:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
INTERVIEWOS_AGENT_SOURCE=local
```

Optional:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Keep `OPENAI_API_KEY` server-only. Do not prefix it with `NEXT_PUBLIC_`.

## Supabase Checklist

1. Apply every SQL file in `supabase/migrations`.
2. Enable anonymous sign-ins in Supabase Auth.
3. Add the Supabase project URL and anon key to Vercel.
4. Create one practice session in the deployed app.
5. Confirm rows appear in `interview_sessions`, `interview_messages`,
   `evaluations`, and `rubric_scores`.

## Local Checks

Run this before deployment:

```bash
npm run check
npm run demo:check
```

Run this when Supabase env vars are available:

```bash
npm run deploy:check
```

Run the full browser flow locally or in CI:

```bash
npm run quality
```

## Interview Talking Point

The deployed demo can run in a no-cost deterministic mode while preserving the
same agent contract as the OpenAI path. That keeps the project reliable for
reviewers and makes the production upgrade path explainable: switch the server
environment from local agent mode to OpenAI, keep the same schemas, and keep the
same fallback behavior.
