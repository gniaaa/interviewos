# InterviewOS Codebase Notes

This project has one main idea: keep the interview coach explainable. The UI
collects session state, the API route validates it, and the agent returns one
structured action at a time.

## Main Flow

1. The user starts or continues a session from a page in `src/components/interviewos/pages`.
2. Shared UI actions live in `src/components/interviewos/provider.tsx`.
3. The provider sends `AgentTurnRequest` to `src/app/api/interview/turn/route.ts`.
4. The route validates the payload with `AgentTurnRequestSchema`.
5. The route tries OpenAI structured output through `runOpenAiAgentTurn`.
6. If OpenAI is unavailable or invalid, the route uses `runLocalAgentTurn`.
7. The returned `AgentTurn` is validated, added to the transcript, and shown in the UI.
8. The provider saves the updated session through `src/lib/supabase.ts` when
   Supabase is configured, while still keeping a local fallback copy.

## Agent Actions

`ask_follow_up`

Use this when the session should continue. The agent policy raises this score
when there is an active answer and a weak rubric area that still needs probing.

`evaluate_answer`

Use this when the user ends the session or the transcript has enough candidate
turns. The tool returns an overall score, rubric breakdown, strengths,
improvement areas, follow-up questions, and a suggested drill.

`suggest_drill`

Use this when the latest answer is too thin, the candidate appears stuck, or the
request triggers a guardrail. The coach gives a smaller practice rep before
asking the candidate to try the original prompt again.

## Agent Decision Policy

The local fallback is intentionally explainable. It does four things:

1. Builds interview state from the transcript: turn count, word count, keyword
   signals, missing rubric areas, stuck-answer signals, and exact-company
   guardrail signals.
2. Scores all available actions from 0 to 100.
3. Picks the highest-scoring action and calculates confidence from the gap
   between the top scores.
4. Returns the chosen action plus `decisionSignals`, `actionScores`, and
   `decisionReason` so the UI can show why the agent acted.

This is the simple version of an agent loop: observe state, decide between tools,
act through the selected tool, then validate the structured result.

## Files To Know

`src/lib/interview/types.ts`

The TypeScript data model. If you are explaining the project, start here because
these types define the product language.

`src/lib/interview/schemas.ts`

Runtime validation for API inputs and model outputs. This is what lets the app
trust structured JSON from either OpenAI or the local fallback.

`src/lib/interview/agent.ts`

The deterministic local agent. It mirrors the production agent workflow:
build state, decide action, dispatch to a tool-style function, return an
`AgentTurn`.

`src/lib/interview/openai-agent.ts`

The OpenAI structured-output path. It asks the model to return the same
`AgentTurn` shape as the local fallback.

`src/app/api/interview/turn/route.ts`

The backend boundary. UI code should call this route instead of calling OpenAI
directly.

`src/lib/supabase.ts`

The Supabase adapter. It handles browser client creation, anonymous demo auth,
session loading, session saving, profile loading, and profile saving. UI code
should keep working with `InterviewSession` rather than database column names.

`supabase/migrations/*`

SQL schema for profiles, interview sessions, transcript messages, evaluations,
rubric scores, and practice goals. Row-level security scopes every row to the
current `auth.uid()`.

`src/components/interviewos/provider.tsx`

The client state layer. It uses local storage as a fallback cache and Supabase
as the real persistence layer when environment variables and anonymous auth are
ready.

`src/components/interviewos/app-shell.tsx`

The sidebar workspace shell. It is intentionally separate from product state so
navigation can stay stable while the interview logic evolves. It reads
persistence status only to show the storage badge.

`src/components/interviewos/pages/*`

The route-level product surfaces: dashboard, interview, evaluation, progress,
and settings.

`scripts/run-evals.ts`

Small regression checks for agent routing and guardrails. These are intentionally
simple now and should grow as the coach gets smarter.

## Supabase Persistence

The app does not require Supabase credentials for local UI work. If
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, it
uses local storage plus seed sessions.

When those variables are present, the provider asks Supabase Auth for the current
user. If none exists, it tries anonymous sign-in. That gives the demo a real
`auth.uid()` without building the full login UI yet.

Important Supabase dashboard setting: enable anonymous sign-ins under Auth before
expecting browser session sync.

The first persisted objects are `profiles`, `interview_sessions`,
`interview_messages`, `evaluations`, and `rubric_scores`. `practice_goals` is in
the schema now so we can add weekly goals without another data-model rewrite.
