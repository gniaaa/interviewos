import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const strict = process.argv.includes("--strict");

const env = {
  agentSource: process.env.INTERVIEWOS_AGENT_SOURCE,
  hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
  openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseDisabled:
    process.env.NEXT_PUBLIC_INTERVIEWOS_DISABLE_SUPABASE === "true",
};

const supabaseReady =
  !env.supabaseDisabled && env.hasSupabaseUrl && env.hasSupabaseAnonKey;
const agentMode =
  env.agentSource === "local"
    ? "Local deterministic agent"
    : env.hasOpenAiKey
      ? `OpenAI structured output (${env.openAiModel}) with local fallback`
      : "Local deterministic agent because OPENAI_API_KEY is missing";
const persistenceMode = env.supabaseDisabled
  ? "Local storage only because Supabase is disabled"
  : supabaseReady
    ? "Supabase anonymous-user persistence"
    : "Local storage only because Supabase keys are missing";

const checks = [
  {
    label: "Agent mode",
    ok: true,
    detail: agentMode,
  },
  {
    label: "Supabase persistence",
    ok: supabaseReady,
    detail: persistenceMode,
  },
  {
    label: "OpenAI quota safety",
    ok: env.agentSource === "local" || !env.hasOpenAiKey,
    detail:
      env.agentSource === "local" || !env.hasOpenAiKey
        ? "Public demos will not spend OpenAI quota by default"
        : "OpenAI calls are enabled; monitor usage before sharing widely",
  },
];

console.log("\nInterviewOS demo readiness\n");

for (const check of checks) {
  console.log(`${check.ok ? "✓" : "!"} ${check.label}: ${check.detail}`);
}

console.log("\nRecommended Vercel env for a resume demo:");
console.log("- NEXT_PUBLIC_SUPABASE_URL");
console.log("- NEXT_PUBLIC_SUPABASE_ANON_KEY");
console.log("- INTERVIEWOS_AGENT_SOURCE=local for a no-cost deterministic demo");
console.log("- OPENAI_API_KEY only when you are ready to spend real API quota");

if (strict && !supabaseReady) {
  console.error(
    "\nStrict deploy check failed: add Supabase URL and anon key so deployed users can save sessions.",
  );
  process.exit(1);
}
