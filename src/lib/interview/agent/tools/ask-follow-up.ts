import type { AgentTurn } from "../../types";
import { followUps, guardrailNote } from "../constants";
import type { AgentToolInput } from "../types";

// Tool action: ask_follow_up.
// Use this when the interview should continue with one adaptive question.
export function askFollowUpTool({ plan, request }: AgentToolInput): AgentTurn {
  return {
    action: "ask_follow_up",
    toolName: "ask_follow_up",
    toolCalls: ["ask_follow_up"],
    decisionReason: plan.reason,
    confidence: plan.confidence,
    decisionSignals: plan.decisionSignals,
    actionScores: plan.actionScores,
    coachMessage: followUps[request.mode][plan.nextFocusArea],
    sessionStatus: "active",
    evaluation: null,
    nextFocusArea: plan.nextFocusArea,
    progressMemory: null,
    source: "local",
    guardrailNote,
  };
}
