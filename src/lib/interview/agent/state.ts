import type { AgentTurnRequest } from "../types";
import {
  detectExactCompanyQuestion,
  detectStuckAnswer,
  extractRubricSignals,
  findStrongestArea,
  findWeakestArea,
  normalizeCoverage,
  rubricAreasByCoverage,
} from "./signals";
import type { InterviewAgentState } from "./types";

// Observe phase: compress the raw transcript into evidence the planner can score.
export function observeTranscript(
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
  const signals = extractRubricSignals(lastAnswer || answerText);
  const coverage = normalizeCoverage(signals);
  const coveredAreas = rubricAreasByCoverage(coverage, "covered");
  const missingAreas = rubricAreasByCoverage(coverage, "missing");
  const memoryFocus = request.progressMemory?.repeatedWeakAreas[0];

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
    memoryFocusArea: memoryFocus?.area,
    memoryFocusCount: memoryFocus?.count ?? 0,
    appearsStuck: detectStuckAnswer(lastAnswer),
    asksForExactCompanyQuestion: detectExactCompanyQuestion(
      `${request.prompt} ${lastAnswer}`,
    ),
  };
}

export const buildInterviewState = observeTranscript;
