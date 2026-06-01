import type {
  Difficulty,
  Evaluation,
  InterviewMode,
  InterviewSession,
  PromptItem,
  RubricArea,
} from "./types";

export const promptLibrary: PromptItem[] = [
  {
    id: "url-shortener",
    mode: "System Design",
    title: "Design a URL shortener",
    difficultyHint: "Mid",
  },
  {
    id: "youtube",
    mode: "System Design",
    title: "Design YouTube",
    difficultyHint: "Senior",
  },
  {
    id: "rate-limiter",
    mode: "System Design",
    title: "Design a rate limiter",
    difficultyHint: "Mid",
  },
  {
    id: "coworker-conflict",
    mode: "Behavioral",
    title: "Tell me about a conflict with a coworker",
    difficultyHint: "Entry",
  },
  {
    id: "proud-project",
    mode: "Behavioral",
    title: "Explain a project you are proud of",
    difficultyHint: "Mid",
  },
  {
    id: "technical-project",
    mode: "Coding Explanation",
    title: "Explain a technical project end to end",
    difficultyHint: "Mid",
  },
];

export const defaultRubric: Array<{
  area: RubricArea;
  weight: number;
  description: string;
}> = [
  {
    area: "Structure",
    weight: 20,
    description: "Frames the answer with goals, constraints, and a clear path.",
  },
  {
    area: "Technical depth",
    weight: 25,
    description: "Uses accurate technical details, APIs, data models, and scaling ideas.",
  },
  {
    area: "Tradeoffs",
    weight: 20,
    description: "Explains alternatives, costs, risks, and why a design choice fits.",
  },
  {
    area: "Communication clarity",
    weight: 20,
    description: "Speaks in a crisp, easy-to-follow way with explicit reasoning.",
  },
  {
    area: "Completeness",
    weight: 15,
    description: "Covers the important parts without skipping core requirements.",
  },
];

export const practiceStats = {
  streak: 5,
  sessionsCompleted: 38,
  averageScore: 78,
  monthlyTrend: 11,
  weakAreas: ["Tradeoffs", "Completeness", "Technical depth"] as RubricArea[],
  recommendedMode: "System Design" as InterviewMode,
  recommendedDifficulty: "Senior" as Difficulty,
  recommendedPrompt: "Design a rate limiter",
};

const sampleEvaluation: Evaluation = {
  overallScore: 82,
  rubricScores: [
    {
      area: "Structure",
      score: 4,
      maxScore: 5,
      rationale: "Clear opening frame and mostly linear answer.",
    },
    {
      area: "Technical depth",
      score: 4,
      maxScore: 5,
      rationale: "Covered APIs, storage, and scaling details with useful specificity.",
    },
    {
      area: "Tradeoffs",
      score: 3,
      maxScore: 5,
      rationale: "Mentioned alternatives, but did not fully compare cost and risk.",
    },
    {
      area: "Communication clarity",
      score: 4,
      maxScore: 5,
      rationale: "Concise and easy to follow.",
    },
    {
      area: "Completeness",
      score: 4,
      maxScore: 5,
      rationale: "Handled most core requirements and left one edge case light.",
    },
  ],
  strengths: [
    "Strong problem framing before diving into implementation.",
    "Good use of concrete system components and scaling vocabulary.",
  ],
  improvementAreas: [
    "Make tradeoffs explicit instead of implying them.",
    "Close with failure modes and operational concerns.",
  ],
  suggestedNextDrill:
    "Take one design choice and compare two alternatives in 90 seconds.",
  followUpQuestions: [
    "What would change if write volume increased 10x?",
    "Which data consistency guarantee matters most for this product?",
  ],
  weakAreaTags: ["Tradeoffs", "Completeness"],
};

export const seedSessions: InterviewSession[] = [
  {
    id: "session_001",
    mode: "System Design",
    difficulty: "Mid",
    prompt: "Design a URL shortener",
    status: "evaluated",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    durationMinutes: 42,
    messages: [],
    evaluation: sampleEvaluation,
  },
  {
    id: "session_002",
    mode: "Behavioral",
    difficulty: "Entry",
    prompt: "Tell me about a conflict with a coworker",
    status: "evaluated",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 55).toISOString(),
    durationMinutes: 18,
    messages: [],
    evaluation: {
      ...sampleEvaluation,
      overallScore: 74,
      weakAreaTags: ["Structure", "Communication clarity"],
    },
  },
  {
    id: "session_003",
    mode: "Coding Explanation",
    difficulty: "Mid",
    prompt: "Explain a technical project end to end",
    status: "evaluated",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    durationMinutes: 22,
    messages: [],
    evaluation: {
      ...sampleEvaluation,
      overallScore: 79,
      weakAreaTags: ["Technical depth", "Tradeoffs"],
    },
  },
];

export const weeklyActivity = [
  { day: "Mon", sessions: 1 },
  { day: "Tue", sessions: 2 },
  { day: "Wed", sessions: 0 },
  { day: "Thu", sessions: 1 },
  { day: "Fri", sessions: 3 },
  { day: "Sat", sessions: 1 },
  { day: "Sun", sessions: 2 },
];

export const skillTrendData = [
  { label: "W1", structure: 58, depth: 52, tradeoffs: 49, communication: 65 },
  { label: "W2", structure: 63, depth: 55, tradeoffs: 54, communication: 68 },
  { label: "W3", structure: 67, depth: 62, tradeoffs: 58, communication: 71 },
  { label: "W4", structure: 70, depth: 65, tradeoffs: 60, communication: 73 },
  { label: "W5", structure: 74, depth: 69, tradeoffs: 64, communication: 76 },
  { label: "W6", structure: 78, depth: 72, tradeoffs: 67, communication: 79 },
];

export const weakAreaInsights = [
  { tag: "Capacity estimation", count: 7, area: "Technical depth" as RubricArea },
  { tag: "Database sharding", count: 5, area: "Technical depth" as RubricArea },
  { tag: "Tradeoff articulation", count: 4, area: "Tradeoffs" as RubricArea },
  { tag: "STAR structure", count: 3, area: "Structure" as RubricArea },
  { tag: "Quantified impact", count: 3, area: "Communication clarity" as RubricArea },
];

export const focusAreas = [
  "Requirements gathering",
  "APIs and data models",
  "Scaling bottlenecks",
  "Tradeoff narration",
  "STAR storytelling",
  "Concise technical summaries",
];
