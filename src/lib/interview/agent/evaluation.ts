import { rubricAreas } from "../types";
import type {
  Evaluation,
  InterviewMessage,
  InterviewMode,
  RubricArea,
  RubricScore,
  RubricWeights,
} from "../types";
import { buildDrill, followUps, keywordSignals } from "./constants";
import { extractRubricSignals } from "./signals";

export function evaluateAnswerSet(
  messages: InterviewMessage[],
  mode: InterviewMode,
  rubricWeights?: RubricWeights,
): Evaluation {
  // The evaluation is built from the full candidate answer set, not only the
  // latest message, because rubric scoring should reflect the whole session.
  const answerText = messages
    .filter((message) => message.role === "candidate")
    .map((message) => message.content)
    .join(" ");

  if (hasInsufficientAnswerEvidence(answerText)) {
    return buildInsufficientEvidenceEvaluation(mode);
  }

  const signals = extractRubricSignals(answerText);
  const rubricScores = buildRubricScores(signals, answerText, mode);
  const overallScore = calculateOverallScore(rubricScores, rubricWeights);
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

function calculateOverallScore(
  rubricScores: RubricScore[],
  rubricWeights?: RubricWeights,
) {
  const weights = rubricWeights ?? null;
  const totalWeight =
    weights &&
    rubricScores.reduce((sum, item) => sum + (weights[item.area] ?? 0), 0);

  if (!weights || !totalWeight) {
    const total = rubricScores.reduce((sum, item) => sum + item.score, 0);
    return Math.round((total / (rubricScores.length * 5)) * 100);
  }

  const weightedScore = rubricScores.reduce((sum, item) => {
    const weight = weights[item.area] ?? 0;
    return sum + (item.score / item.maxScore) * weight;
  }, 0);

  return Math.round((weightedScore / totalWeight) * 100);
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

export function hasInsufficientAnswerEvidence(text: string) {
  const normalized = text.trim().toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const alphaCharacters = normalized.replace(/[^a-z]/g, "");
  const hasRubricSignal = rubricAreas.some((area) =>
    keywordSignals[area].some((keyword) => normalized.includes(keyword)),
  );
  const onlyClarifyingQuestion =
    normalized.includes("?") &&
    words.length < 18 &&
    /should i|do you want|assume|clarify|before i answer/.test(normalized);

  return (
    words.length < 3 ||
    alphaCharacters.length < 8 ||
    (words.length < 8 && !hasRubricSignal) ||
    onlyClarifyingQuestion
  );
}

function buildInsufficientEvidenceEvaluation(mode: InterviewMode): Evaluation {
  const rubricScores = rubricAreas.map((area) => ({
    area,
    score: 0,
    maxScore: 5,
    rationale: `${area} could not be scored because the response did not provide enough ${mode.toLowerCase()} answer evidence.`,
  }));

  return {
    overallScore: 0,
    rubricScores,
    strengths: [
      "No interview-ready answer evidence was provided in this turn.",
    ],
    improvementAreas: [
      "Give a complete answer before ending the session so the coach can score the rubric fairly.",
      "If you need clarification, ask it first, then continue with your assumptions and design.",
    ],
    suggestedNextDrill:
      "Restart the prompt and give a 60-second answer with requirements, constraints, and one concrete design decision.",
    followUpQuestions: [
      followUps[mode].Structure,
      followUps[mode]["Communication clarity"],
    ],
    weakAreaTags: ["Structure", "Communication clarity"],
  };
}

function clampScore(score: number) {
  return Math.max(0, Math.min(5, Math.round(score)));
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
