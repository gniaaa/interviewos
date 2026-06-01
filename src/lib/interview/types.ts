export const interviewModes = [
  "System Design",
  "Behavioral",
  "Coding Explanation",
] as const;

export const difficulties = ["Entry", "Mid", "Senior"] as const;

export const rubricAreas = [
  "Structure",
  "Technical depth",
  "Tradeoffs",
  "Communication clarity",
  "Completeness",
] as const;

export type InterviewMode = (typeof interviewModes)[number];
export type Difficulty = (typeof difficulties)[number];
export type RubricArea = (typeof rubricAreas)[number];

export type RubricWeights = Record<RubricArea, number>;

export type MessageRole = "coach" | "candidate" | "system";

// A transcript is just an ordered list of messages. Keeping this type small makes
// it easy to save later in Supabase without reshaping the UI state.
export type InterviewMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

// Each rubric score is normalized to a 1-5 scale. The overall percentage is
// derived from these scores so the evaluation stays explainable.
export type RubricScore = {
  area: RubricArea;
  score: number;
  maxScore: number;
  rationale: string;
};

export type Evaluation = {
  overallScore: number;
  rubricScores: RubricScore[];
  strengths: string[];
  improvementAreas: string[];
  suggestedNextDrill: string;
  followUpQuestions: string[];
  weakAreaTags: RubricArea[];
};

// A session starts active. It becomes evaluated when the agent scores it, or
// abandoned when the user intentionally discards it or starts over.
export type SessionStatus = "active" | "evaluated" | "abandoned";
export type AgentSessionStatus = Extract<SessionStatus, "active" | "evaluated">;

export type InterviewSession = {
  id: string;
  mode: InterviewMode;
  difficulty: Difficulty;
  prompt: string;
  status: SessionStatus;
  createdAt: string;
  durationMinutes?: number;
  messages: InterviewMessage[];
  evaluation?: Evaluation;
};

export type PromptItem = {
  id: string;
  mode: InterviewMode;
  title: string;
  difficultyHint: Difficulty;
};

export type AgentAction = "ask_follow_up" | "evaluate_answer" | "suggest_drill";

export type AgentActionScores = Record<AgentAction, number>;

export type WeakAreaMemory = {
  area: RubricArea;
  count: number;
};

export type ProgressMemory = {
  sessionsCompleted: number;
  averageScore?: number;
  repeatedWeakAreas: WeakAreaMemory[];
  lastSessionAt?: string;
};

// AgentTurn is the contract between the backend route and the UI. It always
// includes the action chosen, the tool-style action that ran, and a short reason
// you can show while debugging or explaining the project in an interview.
// The scores and signals make the agent's choice auditable instead of a hidden
// model response or a single hard-coded branch.
export type AgentTurn = {
  action: AgentAction;
  toolName: AgentAction;
  decisionReason: string;
  confidence: number;
  decisionSignals: string[];
  actionScores: AgentActionScores;
  coachMessage: string;
  sessionStatus: AgentSessionStatus;
  evaluation: Evaluation | null;
  nextFocusArea: RubricArea | null;
  source: "local" | "openai" | "openai_fallback";
  guardrailNote: string;
};

// The UI sends this payload for every coach turn. forceEvaluate is set when the
// user ends the session, which tells the agent to score instead of continue.
export type AgentTurnRequest = {
  mode: InterviewMode;
  difficulty: Difficulty;
  prompt: string;
  messages: InterviewMessage[];
  rubricWeights?: RubricWeights;
  progressMemory?: ProgressMemory;
  forceEvaluate?: boolean;
};
