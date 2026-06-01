import type { AgentTurn, AgentTurnRequest } from "../types";
import { createCoachOpening } from "./constants";
import { evaluateAnswerSet, hasInsufficientAnswerEvidence } from "./evaluation";
import {
  chooseAction,
  chooseFocusArea,
  decideNextAction,
  explainDecision,
  explainSignals,
  planAgentTurn,
  scoreActions,
} from "./planner";
import { buildInterviewState, observeTranscript } from "./state";
import { interviewAgentTools } from "./tools";

// Local agent overview:
// 1. Observe: build compact state from the transcript.
// 2. Plan: score actions, choose the next action, and explain the decision.
// 3. Act: dispatch to a named tool-style function for that action.
// This mirrors the OpenAI path while staying deterministic for demos and evals.
export function runLocalAgentTurn(request: AgentTurnRequest): AgentTurn {
  const plan = planAgentTurn(request);
  const tool = interviewAgentTools[plan.action];

  // The tool function returns the same AgentTurn shape OpenAI is expected to
  // return, which keeps UI behavior identical across local and model sources.
  return tool({ plan, request });
}

export {
  buildInterviewState,
  chooseAction,
  chooseFocusArea,
  createCoachOpening,
  decideNextAction,
  evaluateAnswerSet,
  explainDecision,
  explainSignals,
  hasInsufficientAnswerEvidence,
  interviewAgentTools,
  observeTranscript,
  planAgentTurn,
  scoreActions,
};

export type {
  AgentDecision,
  AgentPlan,
  AgentToolInput,
  InterviewAgentState,
  PlannerStep,
} from "./types";
