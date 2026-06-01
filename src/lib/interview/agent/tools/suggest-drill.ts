import type { AgentTurn } from "../../types";
import { buildDrill, guardrailNote } from "../constants";
import type { AgentToolInput } from "../types";

// Tool action: suggest_drill.
// Use this when the candidate needs a smaller practice rep before continuing.
export function suggestDrillTool({ plan, request }: AgentToolInput): AgentTurn {
  const guardrailPrefix = plan.state.asksForExactCompanyQuestion
    ? "I cannot verify or fabricate exact company interview questions. Let's practice the underlying skill instead. "
    : "";

  return {
    action: "suggest_drill",
    toolName: "suggest_drill",
    toolCalls: ["suggest_drill"],
    decisionReason: plan.reason,
    confidence: plan.confidence,
    decisionSignals: plan.decisionSignals,
    actionScores: plan.actionScores,
    coachMessage: `${guardrailPrefix}${buildDrill(plan.nextFocusArea, request.mode)} Then answer the original prompt again with that structure.`,
    sessionStatus: "active",
    evaluation: null,
    nextFocusArea: plan.nextFocusArea,
    progressMemory: null,
    source: "local",
    guardrailNote,
  };
}
