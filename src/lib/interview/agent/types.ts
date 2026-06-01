import type {
  AgentAction,
  AgentActionScores,
  AgentTurnRequest,
  RubricArea,
} from "../types";

export type InterviewAgentState = {
  answerText: string;
  answerWordCount: number;
  candidateTurnCount: number;
  lastAnswer: string;
  latestWordCount: number;
  signals: Record<RubricArea, number>;
  coverage: Record<RubricArea, number>;
  coveredAreas: RubricArea[];
  missingAreas: RubricArea[];
  weakestArea: RubricArea;
  strongestArea: RubricArea;
  memoryFocusArea?: RubricArea;
  memoryFocusCount: number;
  appearsStuck: boolean;
  asksForExactCompanyQuestion: boolean;
};

export type AgentDecision = {
  action: AgentAction;
  nextFocusArea: RubricArea;
  reason: string;
  confidence: number;
  decisionSignals: string[];
  actionScores: AgentActionScores;
};

export type PlannerStep =
  | "observe_transcript"
  | "extract_signals"
  | "score_actions"
  | "choose_action"
  | "explain_decision";

export type AgentPlan = AgentDecision & {
  state: InterviewAgentState;
  plannerSteps: PlannerStep[];
};

export type AgentToolInput = {
  plan: AgentPlan;
  request: AgentTurnRequest;
};
