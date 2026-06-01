import type {
  AgentAction,
  AgentActionScores,
  AgentTurnRequest,
  RubricArea,
} from "../types";
import { clampPercent, roundToTwoDecimals } from "./signals";
import { observeTranscript } from "./state";
import type { AgentDecision, AgentPlan, InterviewAgentState } from "./types";

const plannerSteps = [
  "observe_transcript",
  "extract_signals",
  "score_actions",
  "choose_action",
  "explain_decision",
] as const;

// Planner phase: turn a raw request into an explicit action plan. Keeping this
// separate from tools makes the local agent easier to debug and explain.
export function planAgentTurn(request: AgentTurnRequest): AgentPlan {
  const state = observeTranscript(request);
  const decision = decideNextAction(request, state);

  return {
    ...decision,
    state,
    plannerSteps: [...plannerSteps],
  };
}

export function decideNextAction(
  request: AgentTurnRequest,
  state: InterviewAgentState,
): AgentDecision {
  const actionScores = scoreActions(request, state);
  const action = chooseAction(actionScores);
  const nextFocusArea = chooseFocusArea(action, state);
  const confidence = calculateDecisionConfidence(actionScores);
  const decisionSignals = explainSignals({
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
    reason: explainDecision(action, nextFocusArea, state, request),
  };
}

export function scoreActions(
  request: AgentTurnRequest,
  state: InterviewAgentState,
): AgentActionScores {
  // The planner starts with a prior for each tool, then adds or subtracts
  // evidence. This is intentionally inspectable: every score can be explained
  // from transcript state instead of disappearing into a single model response.
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

  if (
    state.memoryFocusArea &&
    state.memoryFocusCount >= 2 &&
    !state.missingAreas.includes(state.memoryFocusArea) &&
    state.candidateTurnCount < 3
  ) {
    addScore(scores, "ask_follow_up", 10);
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

export function chooseAction(scores: AgentActionScores): AgentAction {
  const priority: AgentAction[] = [
    "evaluate_answer",
    "suggest_drill",
    "ask_follow_up",
  ];

  return priority.reduce((selected, action) =>
    scores[action] > scores[selected] ? action : selected,
  );
}

export function chooseFocusArea(
  action: AgentAction,
  state: InterviewAgentState,
) {
  if (
    action === "suggest_drill" &&
    (state.appearsStuck ||
      state.latestWordCount < 18 ||
      state.asksForExactCompanyQuestion)
  ) {
    return "Structure";
  }

  if (
    action === "ask_follow_up" &&
    state.memoryFocusArea &&
    state.memoryFocusCount >= 2 &&
    state.coverage[state.memoryFocusArea] < 0.65
  ) {
    return state.memoryFocusArea;
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

export function explainSignals({
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

  if (state.memoryFocusArea) {
    signals.push(
      `memory focus: ${state.memoryFocusArea} was weak in ${state.memoryFocusCount} recent sessions`,
    );
  }

  if (state.appearsStuck) {
    signals.push("candidate appears stuck or asked for a hint");
  }

  if (state.asksForExactCompanyQuestion) {
    signals.push("guardrail: exact company-question request detected");
  }

  return signals;
}

export function explainDecision(
  action: AgentAction,
  nextFocusArea: RubricArea,
  state: InterviewAgentState,
  request: AgentTurnRequest,
) {
  if (request.forceEvaluate) {
    return "The user ended the session, so the planner selected evaluation and scored the full transcript.";
  }

  if (action === "evaluate_answer") {
    return `The planner found enough interview signal across ${state.candidateTurnCount} turns, so it selected evaluation and will score the weakest area first: ${nextFocusArea}.`;
  }

  if (action === "suggest_drill") {
    const driver = state.appearsStuck
      ? "the candidate appears stuck"
      : state.asksForExactCompanyQuestion
        ? "the answer triggered the exact-company-question guardrail"
        : "the latest answer is too thin for fair scoring";

    return `The planner selected a focused drill because ${driver}; the next useful practice target is ${nextFocusArea}.`;
  }

  if (
    state.memoryFocusArea === nextFocusArea &&
    state.memoryFocusCount >= 2
  ) {
    return `The planner selected an adaptive follow-up because ${nextFocusArea} is a repeated weak area from recent sessions and still needs coverage in this answer.`;
  }

  return `The planner selected an adaptive follow-up because the session is still active and ${nextFocusArea} is the weakest detected rubric area.`;
}
