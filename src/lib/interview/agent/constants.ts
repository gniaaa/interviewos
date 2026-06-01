import { uid } from "../../utils";
import type { InterviewMessage, InterviewMode, RubricArea } from "../types";

export const guardrailNote =
  "Scores are coaching feedback, not ground truth. InterviewOS will not fabricate exact company interview questions.";

// Lightweight signals used by the local fallback. This is not trying to be a
// perfect grader. It gives the agent observable evidence it can use while the
// OpenAI path is still being connected and evaluated.
export const keywordSignals: Record<RubricArea, string[]> = {
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
export const followUps: Record<InterviewMode, Record<RubricArea, string>> = {
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

export function buildDrill(area: RubricArea, mode: InterviewMode) {
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
