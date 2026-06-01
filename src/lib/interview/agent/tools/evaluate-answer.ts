import type { AgentTurn } from "../../types";
import { guardrailNote } from "../constants";
import { evaluateAnswerSet } from "../evaluation";
import type { AgentToolInput } from "../types";
import { updateProgressMemoryTool } from "./update-progress-memory";

// Tool action: evaluate_answer.
// Use this when the session has enough signal or the user clicked End session.
export function evaluateAnswerTool({ plan, request }: AgentToolInput): AgentTurn {
  const evaluation = evaluateAnswerSet(
    request.messages,
    request.mode,
    request.rubricWeights,
  );
  const progressMemory = updateProgressMemoryTool({
    completedAt: new Date().toISOString(),
    evaluation,
    previousMemory: request.progressMemory,
  });

  return {
    action: "evaluate_answer",
    toolName: "evaluate_answer",
    toolCalls: ["evaluate_answer", "update_progress_memory"],
    decisionReason: plan.reason,
    confidence: plan.confidence,
    decisionSignals: [
      ...plan.decisionSignals,
      `progress memory updated to ${progressMemory.sessionsCompleted} completed sessions`,
    ],
    actionScores: plan.actionScores,
    coachMessage:
      "I have enough signal to score this round. Review the rubric, then use the next drill to tighten the weakest area.",
    sessionStatus: "evaluated",
    evaluation,
    nextFocusArea: evaluation.weakAreaTags[0],
    progressMemory,
    source: "local",
    guardrailNote,
  };
}
