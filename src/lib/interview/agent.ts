import { uid } from "../utils";
import { rubricAreas } from "./types";
import type {
  AgentAction,
  AgentActionScores,
  AgentTurn,
  AgentTurnRequest,
  Evaluation,
  InterviewMessage,
  InterviewMode,
  RubricArea,
  RubricScore,
} from "./types";

// Local agent overview:
// 1. Build compact state from the transcript.
// 2. Decide which action should happen next.
// 3. Dispatch to a named tool-style function for that action.
// This mirrors the OpenAI path while staying deterministic for demos and evals.
const guardrailNote =
  "Scores are coaching feedback, not ground truth. InterviewOS will not fabricate exact company interview questions.";

type InterviewAgentState = {
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
  appearsStuck: boolean;
  asksForExactCompanyQuestion: boolean;
};

type AgentDecision = {
  action: AgentAction;
  nextFocusArea: RubricArea;
  reason: string;
  confidence: number;
  decisionSignals: string[];
  actionScores: AgentActionScores;
};

type AgentToolInput = {
  decision: AgentDecision;
  request: AgentTurnRequest;
  state: InterviewAgentState;
};

// Lightweight signals used by the local fallback. This is not trying to be a
// perfect grader. It gives the agent observable evidence it can use while the
// OpenAI path is still being connected and evaluated.
const keywordSignals: Record<RubricArea, string[]> = {
  Structure: [
    "first",
    "second",
    "goal",
    "requirements",
    "constraint",
    "scope",
    "approach",
    "break",
    "start",
  ],
  "Technical depth": [
    "api",
    "database",
    "cache",
    "queue",
    "schema",
    "latency",
    "partition",
    "replication",
    "shard",
    "index",
    "throughput",
    "consistency",
  ],
  Tradeoffs: [
    "tradeoff",
    "however",
    "because",
    "alternative",
    "versus",
    "cost",
    "risk",
    "downside",
    "simpler",
    "complexity",
  ],
  "Communication clarity": [
    "so",
    "because",
    "for example",
    "in other words",
    "the reason",
    "to summarize",
    "clarify",
  ],
  Completeness: [
    "edge",
    "failure",
    "monitoring",
    "security",
    "testing",
    "migration",
    "availability",
    "reliability",
    "observability",
  ],
};

// Follow-ups are indexed by interview mode and weakest rubric area. That lets
// the agent adapt the next question without hard-coding one linear script.
const followUps: Record<InterviewMode, Record<RubricArea, string>> = {
  "System Design": {
    Structure:
      "Before we go deeper, state the functional requirements, non-functional requirements, and the first two components you would design.",
    "Technical depth":
      "Walk me through the APIs, the main data model, and the bottleneck you expect first.",
    Tradeoffs:
      "Choose one design decision and compare it with an alternative. What do you gain and what do you give up?",
    "Communication clarity":
      "Pause and restate your design in a simpler sequence: request path, storage path, and read path.",
    Completeness:
      "What failure mode, abuse case, or operational concern would you handle next?",
  },
  Behavioral: {
    Structure:
      "Reframe that using Situation, Task, Action, and Result. Keep each part to one or two sentences.",
    "Technical depth":
      "Add one concrete detail about the technical context so the interviewer can calibrate the difficulty.",
    Tradeoffs:
      "What options did you consider, and why did you choose the one you used?",
    "Communication clarity":
      "Tighten the story into a crisp before, action, and after arc.",
    Completeness:
      "What did you learn, and what would you do differently now?",
  },
  "Coding Explanation": {
    Structure:
      "Give me the high-level algorithm first, then the key data structures, then complexity.",
    "Technical depth":
      "Explain the core invariant or edge case that makes this solution correct.",
    Tradeoffs:
      "Compare this approach with a simpler or more memory-efficient alternative.",
    "Communication clarity":
      "Say it again as if you were explaining it while writing code on a whiteboard.",
    Completeness:
      "Cover time complexity, space complexity, and one edge case test.",
  },
};

export function createCoachOpening(
  mode: InterviewMode,
  prompt: string,
): InterviewMessage {
  const openingByMode: Record<InterviewMode, string> = {
    "System Design": `Let's practice: ${prompt}. Start by framing the users, core requirements, constraints, and your high-level architecture.`,
    Behavioral: `Let's practice: ${prompt}. Give me the story with enough context, your actions, and the result.`,
    "Coding Explanation": `Let's practice: ${prompt}. Explain the problem, your approach, complexity, and the edge cases you would test.`,
  };

  return {
    id: uid("msg"),
    role: "coach",
    content: openingByMode[mode],
    createdAt: new Date().toISOString(),
  };
}

export function runLocalAgentTurn(request: AgentTurnRequest): AgentTurn {
  const state = buildInterviewState(request);
  const decision = decideNextAction(request, state);
  const tool = interviewAgentTools[decision.action];

  // The tool function returns the same AgentTurn shape OpenAI is expected to
  // return, which keeps UI behavior identical across local and model sources.
  return tool({ decision, request, state });
}

export function buildInterviewState(
  request: AgentTurnRequest,
): InterviewAgentState {
  // Only candidate answers are scored. Coach messages are context, not evidence
  // of the user's skill.
  const candidateMessages = request.messages.filter(
    (message) => message.role === "candidate",
  );
  const answerText = candidateMessages
    .map((message) => message.content)
    .join(" ");
  const lastAnswer = candidateMessages.at(-1)?.content ?? "";
  const signals = scoreSignals(lastAnswer || answerText);
  const coverage = normalizeCoverage(signals);
  const coveredAreas = rubricAreasByCoverage(coverage, "covered");
  const missingAreas = rubricAreasByCoverage(coverage, "missing");

  return {
    answerText,
    answerWordCount: answerText.split(/\s+/).filter(Boolean).length,
    candidateTurnCount: candidateMessages.length,
    lastAnswer,
    latestWordCount: lastAnswer.split(/\s+/).filter(Boolean).length,
    signals,
    coverage,
    coveredAreas,
    missingAreas,
    weakestArea: findWeakestArea(signals),
    strongestArea: findStrongestArea(signals),
    appearsStuck: detectStuckAnswer(lastAnswer),
    asksForExactCompanyQuestion: detectExactCompanyQuestion(
      `${request.prompt} ${lastAnswer}`,
    ),
  };
}

export function decideNextAction(
  request: AgentTurnRequest,
  state: InterviewAgentState,
): AgentDecision {
  const actionScores = scoreCandidateActions(request, state);
  const action = selectHighestScoringAction(actionScores);
  const nextFocusArea = pickFocusArea(action, state);
  const confidence = calculateDecisionConfidence(actionScores);
  const decisionSignals = buildDecisionSignals({
    action,
    actionScores,
    request,
    state,
  });

  return {
    action,
    nextFocusArea,
    confidence,
    actionScores,
    decisionSignals,
    reason: buildDecisionReason(action, nextFocusArea, state, request),
  };
}

function scoreCandidateActions(
  request: AgentTurnRequest,
  state: InterviewAgentState,
): AgentActionScores {
  // The policy starts with a prior for each tool, then adds or subtracts evidence.
  // This gives us a debuggable decision instead of burying everything in one
  // model response or a brittle sequence of branches.
  const scores: AgentActionScores = {
    ask_follow_up: state.candidateTurnCount === 0 ? 80 : 45,
    evaluate_answer: 15,
    suggest_drill: 15,
  };

  if (request.forceEvaluate) {
    return {
      ask_follow_up: 0,
      evaluate_answer: 100,
      suggest_drill: 0,
    };
  }

  if (state.candidateTurnCount >= 3) {
    addScore(scores, "evaluate_answer", 55);
    addScore(scores, "ask_follow_up", -20);
  }

  if (state.candidateTurnCount === 2 && state.answerWordCount >= 120) {
    addScore(scores, "evaluate_answer", 25);
  }

  if (state.answerWordCount >= 180 && state.missingAreas.length <= 2) {
    addScore(scores, "evaluate_answer", 20);
  }

  if (
    state.candidateTurnCount > 0 &&
    state.candidateTurnCount < 3 &&
    state.latestWordCount < 18
  ) {
    addScore(scores, "suggest_drill", state.latestWordCount < 8 ? 75 : 55);
    addScore(scores, "ask_follow_up", -15);
    addScore(scores, "evaluate_answer", -20);
  }

  if (state.appearsStuck) {
    addScore(scores, "suggest_drill", 60);
    addScore(scores, "ask_follow_up", -10);
  }

  if (state.asksForExactCompanyQuestion) {
    addScore(scores, "suggest_drill", 70);
    addScore(scores, "ask_follow_up", -20);
    addScore(scores, "evaluate_answer", -15);
  }

  if (state.candidateTurnCount > 0 && state.latestWordCount >= 18) {
    addScore(scores, "ask_follow_up", 25);
  }

  if (state.missingAreas.length >= 3 && state.latestWordCount >= 18) {
    addScore(scores, "ask_follow_up", 20);
  }

  if (state.missingAreas.includes("Structure") && state.latestWordCount < 60) {
    addScore(scores, "suggest_drill", 15);
  }

  if (state.coveredAreas.length >= 4 && state.candidateTurnCount >= 2) {
    addScore(scores, "evaluate_answer", 15);
  }

  return normalizeActionScores(scores);
}

function addScore(
  scores: AgentActionScores,
  action: AgentAction,
  amount: number,
) {
  scores[action] += amount;
}

function normalizeActionScores(scores: AgentActionScores): AgentActionScores {
  return {
    ask_follow_up: clampPercent(scores.ask_follow_up),
    evaluate_answer: clampPercent(scores.evaluate_answer),
    suggest_drill: clampPercent(scores.suggest_drill),
  };
}

function selectHighestScoringAction(scores: AgentActionScores): AgentAction {
  const priority: AgentAction[] = [
    "evaluate_answer",
    "suggest_drill",
    "ask_follow_up",
  ];

  return priority.reduce((selected, action) =>
    scores[action] > scores[selected] ? action : selected,
  );
}

function pickFocusArea(action: AgentAction, state: InterviewAgentState) {
  if (
    action === "suggest_drill" &&
    (state.appearsStuck ||
      state.latestWordCount < 18 ||
      state.asksForExactCompanyQuestion)
  ) {
    return "Structure";
  }

  return state.weakestArea;
}

function calculateDecisionConfidence(scores: AgentActionScores) {
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const [topScore = 0, secondScore = 0] = sortedScores;
  const gap = topScore - secondScore;

  return roundToTwoDecimals(
    Math.max(0.55, Math.min(0.94, 0.5 + gap / 300 + topScore / 1000)),
  );
}

function buildDecisionSignals({
  action,
  actionScores,
  request,
  state,
}: {
  action: AgentAction;
  actionScores: AgentActionScores;
  request: AgentTurnRequest;
  state: InterviewAgentState;
}) {
  const signals = [
    `${state.candidateTurnCount} candidate turn${state.candidateTurnCount === 1 ? "" : "s"}`,
    `${state.latestWordCount} words in latest answer`,
    `${state.answerWordCount} total candidate words`,
    `weakest area: ${state.weakestArea}`,
    `strongest area: ${state.strongestArea}`,
    `selected ${action} at ${actionScores[action]}/100`,
  ];

  if (request.forceEvaluate) {
    signals.push("user requested final evaluation");
  }

  if (state.missingAreas.length > 0) {
    signals.push(`missing coverage: ${state.missingAreas.join(", ")}`);
  }

  if (state.coveredAreas.length > 0) {
    signals.push(`covered areas: ${state.coveredAreas.join(", ")}`);
  }

  if (state.appearsStuck) {
    signals.push("candidate appears stuck or asked for a hint");
  }

  if (state.asksForExactCompanyQuestion) {
    signals.push("guardrail: exact company-question request detected");
  }

  return signals;
}

function buildDecisionReason(
  action: AgentAction,
  nextFocusArea: RubricArea,
  state: InterviewAgentState,
  request: AgentTurnRequest,
) {
  if (request.forceEvaluate) {
    return "The user ended the session, so the policy selected evaluation and scored the full transcript.";
  }

  if (action === "evaluate_answer") {
    return `The policy found enough interview signal across ${state.candidateTurnCount} turns, so it selected evaluation and will score the weakest area first: ${nextFocusArea}.`;
  }

  if (action === "suggest_drill") {
    const driver = state.appearsStuck
      ? "the candidate appears stuck"
      : state.asksForExactCompanyQuestion
        ? "the answer triggered the exact-company-question guardrail"
        : "the latest answer is too thin for fair scoring";

    return `The policy selected a focused drill because ${driver}; the next useful practice target is ${nextFocusArea}.`;
  }

  return `The policy selected an adaptive follow-up because the session is still active and ${nextFocusArea} is the weakest detected rubric area.`;
}

export const interviewAgentTools: Record<
  AgentAction,
  (input: AgentToolInput) => AgentTurn
> = {
  ask_follow_up: askFollowUpTool,
  evaluate_answer: evaluateAnswerTool,
  suggest_drill: suggestDrillTool,
};

// Tool action: ask_follow_up.
// Use this when the interview should continue with one adaptive question.
function askFollowUpTool({ decision, request }: AgentToolInput): AgentTurn {
  return {
    action: "ask_follow_up",
    toolName: "ask_follow_up",
    decisionReason: decision.reason,
    confidence: decision.confidence,
    decisionSignals: decision.decisionSignals,
    actionScores: decision.actionScores,
    coachMessage: followUps[request.mode][decision.nextFocusArea],
    sessionStatus: "active",
    nextFocusArea: decision.nextFocusArea,
    source: "local",
    guardrailNote,
  };
}

// Tool action: evaluate_answer.
// Use this when the session has enough signal or the user clicked End session.
function evaluateAnswerTool({ decision, request }: AgentToolInput): AgentTurn {
  const evaluation = evaluateAnswerSet(request.messages, request.mode);

  return {
    action: "evaluate_answer",
    toolName: "evaluate_answer",
    decisionReason: decision.reason,
    confidence: decision.confidence,
    decisionSignals: decision.decisionSignals,
    actionScores: decision.actionScores,
    coachMessage:
      "I have enough signal to score this round. Review the rubric, then use the next drill to tighten the weakest area.",
    sessionStatus: "evaluated",
    evaluation,
    nextFocusArea: evaluation.weakAreaTags[0],
    source: "local",
    guardrailNote,
  };
}

// Tool action: suggest_drill.
// Use this when the candidate needs a smaller practice rep before continuing.
function suggestDrillTool({ decision, request, state }: AgentToolInput): AgentTurn {
  const guardrailPrefix = state.asksForExactCompanyQuestion
    ? "I cannot verify or fabricate exact company interview questions. Let's practice the underlying skill instead. "
    : "";

  return {
    action: "suggest_drill",
    toolName: "suggest_drill",
    decisionReason: decision.reason,
    confidence: decision.confidence,
    decisionSignals: decision.decisionSignals,
    actionScores: decision.actionScores,
    coachMessage: `${guardrailPrefix}${buildDrill(decision.nextFocusArea, request.mode)} Then answer the original prompt again with that structure.`,
    sessionStatus: "active",
    nextFocusArea: decision.nextFocusArea,
    source: "local",
    guardrailNote,
  };
}

export function evaluateAnswerSet(
  messages: InterviewMessage[],
  mode: InterviewMode,
): Evaluation {
  // The evaluation is built from the full candidate answer set, not only the
  // latest message, because rubric scoring should reflect the whole session.
  const answerText = messages
    .filter((message) => message.role === "candidate")
    .map((message) => message.content)
    .join(" ");
  const signals = scoreSignals(answerText);
  const rubricScores = buildRubricScores(signals, answerText, mode);
  const total = rubricScores.reduce((sum, item) => sum + item.score, 0);
  const overallScore = Math.round((total / (rubricScores.length * 5)) * 100);
  const sortedWeakAreas = [...rubricScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((score) => score.area);

  return {
    overallScore,
    rubricScores,
    strengths: buildStrengths(rubricScores, mode),
    improvementAreas: buildImprovementAreas(sortedWeakAreas, mode),
    suggestedNextDrill: buildDrill(sortedWeakAreas[0], mode),
    followUpQuestions: sortedWeakAreas.map((area) => followUps[mode][area]),
    weakAreaTags: sortedWeakAreas,
  };
}

function scoreSignals(text: string): Record<RubricArea, number> {
  const normalized = text.toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  // Keyword hits are a transparent proxy for local scoring. When OpenAI is
  // connected, this fallback still gives us a debuggable baseline.
  return Object.fromEntries(
    Object.entries(keywordSignals).map(([area, keywords]) => {
      const keywordHits = keywords.filter((keyword) =>
        normalized.includes(keyword),
      ).length;
      const lengthBonus = wordCount > 90 ? 1 : wordCount > 45 ? 0.5 : 0;
      return [area, keywordHits + lengthBonus];
    }),
  ) as Record<RubricArea, number>;
}

function normalizeCoverage(signals: Record<RubricArea, number>) {
  return Object.fromEntries(
    rubricAreas.map((area) => [area, roundToTwoDecimals(Math.min(1, signals[area] / 3))]),
  ) as Record<RubricArea, number>;
}

function rubricAreasByCoverage(
  coverage: Record<RubricArea, number>,
  type: "covered" | "missing",
) {
  return rubricAreas.filter((area) =>
    type === "covered" ? coverage[area] >= 0.65 : coverage[area] < 0.35,
  );
}

function buildRubricScores(
  signals: Record<RubricArea, number>,
  answerText: string,
  mode: InterviewMode,
): RubricScore[] {
  const wordCount = answerText.split(/\s+/).filter(Boolean).length;

  // Short answers are capped because they usually lack enough evidence across
  // dimensions, even if they happen to contain a few strong keywords.
  return Object.entries(signals).map(([area, signal]) => {
    const score = clampScore(2 + Math.min(signal, 3));
    return {
      area: area as RubricArea,
      score: wordCount < 30 ? Math.min(score, 2) : score,
      maxScore: 5,
      rationale: rationaleFor(area as RubricArea, score, mode),
    };
  });
}

function clampScore(score: number) {
  return Math.max(1, Math.min(5, Math.round(score)));
}

function findWeakestArea(signals: Record<RubricArea, number>) {
  return (Object.entries(signals).sort((a, b) => a[1] - b[1])[0]?.[0] ??
    "Tradeoffs") as RubricArea;
}

function findStrongestArea(signals: Record<RubricArea, number>) {
  return (Object.entries(signals).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Structure") as RubricArea;
}

function detectStuckAnswer(text: string) {
  const normalized = text.toLowerCase();
  return [
    "i don't know",
    "i do not know",
    "not sure",
    "i'm stuck",
    "im stuck",
    "no idea",
    "can't think",
    "can you give me a hint",
    "give me a hint",
    "help me",
  ].some((phrase) => normalized.includes(phrase));
}

function detectExactCompanyQuestion(text: string) {
  const normalized = text.toLowerCase();
  return [
    "exact company interview",
    "exact google",
    "exact meta",
    "exact amazon",
    "exact netflix",
    "real google interview",
    "real meta interview",
    "real amazon interview",
    "asked at google",
    "asked at meta",
    "asked at amazon",
    "leaked interview question",
    "what does google ask",
    "what does meta ask",
  ].some((phrase) => normalized.includes(phrase));
}

function clampPercent(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function rationaleFor(area: RubricArea, score: number, mode: InterviewMode) {
  if (score >= 4) {
    return `${area} was supported with concrete ${mode.toLowerCase()} details.`;
  }

  if (score === 3) {
    return `${area} showed promise, but needs one more explicit example or decision.`;
  }

  return `${area} needs a clearer pass before this answer feels interview-ready.`;
}

function buildStrengths(scores: RubricScore[], mode: InterviewMode) {
  const topAreas = [...scores].sort((a, b) => b.score - a.score).slice(0, 2);
  return topAreas.map(
    (score) =>
      `${score.area} is a relative strength for this ${mode.toLowerCase()} round.`,
  );
}

function buildImprovementAreas(areas: RubricArea[], mode: InterviewMode) {
  return areas.map(
    (area) =>
      `Add a focused ${area.toLowerCase()} pass before moving on in the ${mode.toLowerCase()} answer.`,
  );
}

function buildDrill(area: RubricArea, mode: InterviewMode) {
  const drillByArea: Record<RubricArea, string> = {
    Structure:
      "Spend 3 minutes outlining requirements, constraints, and answer sections before speaking.",
    "Technical depth":
      "Pick one component and explain its API, data model, and bottleneck in 2 minutes.",
    Tradeoffs:
      "Compare two design choices using cost, risk, speed, and operational complexity.",
    "Communication clarity":
      "Record a 90-second version of the same answer and remove filler or repeated ideas.",
    Completeness:
      "End with failure modes, observability, edge cases, and what you would improve next.",
  };

  return `${drillByArea[area]} Use the same ${mode.toLowerCase()} prompt for the drill.`;
}
