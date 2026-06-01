import { runLocalAgentTurn } from "../src/lib/interview/agent";
import type { AgentTurnRequest, InterviewMessage } from "../src/lib/interview/types";

// These evals are tiny regression checks for the local agent workflow. They are
// not model-quality benchmarks yet; they protect the action routing contract.
function message(role: InterviewMessage["role"], content: string): InterviewMessage {
  return {
    id: `eval_${role}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

const cases: Array<{
  name: string;
  request: AgentTurnRequest;
  expect: (result: ReturnType<typeof runLocalAgentTurn>) => boolean;
}> = [
  // Action: ask_follow_up. A substantive active answer should continue the mock
  // interview and target a weak rubric area.
  {
    name: "asks a focused follow-up after one system design answer",
    request: {
      mode: "System Design",
      difficulty: "Mid",
      prompt: "Design a rate limiter",
      messages: [
        message(
          "candidate",
          "I would start with requirements and constraints, then design an API and a cache-backed counter. The main database stores policy config, while Redis handles low-latency counters.",
        ),
      ],
    },
    expect: (result) =>
      result.action === "ask_follow_up" &&
      result.toolName === "ask_follow_up" &&
      result.sessionStatus === "active" &&
      result.decisionReason.length > 0,
  },
  // Action: suggest_drill. A very short answer should get coaching before any
  // serious scoring happens.
  {
    name: "suggests a drill for an underdeveloped active answer",
    request: {
      mode: "System Design",
      difficulty: "Mid",
      prompt: "Design a URL shortener",
      messages: [message("candidate", "I would use a database.")],
    },
    expect: (result) =>
      result.action === "suggest_drill" &&
      result.toolName === "suggest_drill" &&
      result.sessionStatus === "active" &&
      result.nextFocusArea === "Structure",
  },
  // Action: evaluate_answer. Ending or completing a session should produce a
  // structured rubric evaluation.
  {
    name: "evaluates a complete system design answer above baseline",
    request: {
      mode: "System Design",
      difficulty: "Senior",
      prompt: "Design YouTube",
      forceEvaluate: true,
      messages: [
        message(
          "candidate",
          "First I would clarify requirements, users, upload size constraints, latency, availability, and moderation goals. The design has upload APIs, metadata database tables, object storage, a queue for transcoding, cache for hot metadata, and a CDN for playback. The tradeoff is keeping the upload path simple while accepting eventual consistency for processed videos because synchronous transcoding would hurt user latency. I would monitor failures, retries, abuse cases, and regional availability.",
        ),
      ],
    },
    expect: (result) =>
      result.action === "evaluate_answer" &&
      result.toolName === "evaluate_answer" &&
      Boolean(result.evaluation) &&
      result.evaluation!.overallScore >= 75,
  },
  // Guardrail: even short sessions can be evaluated when the user explicitly
  // ends them, but the score should stay humble and coaching-oriented.
  {
    name: "flags short answers as needing structure",
    request: {
      mode: "Behavioral",
      difficulty: "Entry",
      prompt: "Tell me about a conflict with a coworker",
      forceEvaluate: true,
      messages: [message("candidate", "We disagreed, I talked to them, and it worked out.")],
    },
    expect: (result) =>
      result.action === "evaluate_answer" &&
      result.toolName === "evaluate_answer" &&
      Boolean(result.evaluation?.weakAreaTags.includes("Structure")),
  },
  // Calibration: nonsense text should not get the default weak-answer floor.
  {
    name: "scores gibberish as zero evidence",
    request: {
      mode: "System Design",
      difficulty: "Mid",
      prompt: "Design a URL shortener",
      forceEvaluate: true,
      messages: [message("candidate", "asd")],
    },
    expect: (result) =>
      result.action === "evaluate_answer" &&
      result.sessionStatus === "evaluated" &&
      result.evaluation?.overallScore === 0 &&
      result.evaluation.rubricScores.every((score) => score.score === 0),
  },
  // Action: suggest_drill. Asking for a hint is a different signal than simply
  // giving a short answer, and it should route to a smaller practice rep.
  {
    name: "suggests a drill when the candidate is stuck",
    request: {
      mode: "Coding Explanation",
      difficulty: "Entry",
      prompt: "Explain a binary search solution",
      messages: [
        message(
          "candidate",
          "I'm stuck and not sure how to explain this. Can you give me a hint?",
        ),
      ],
    },
    expect: (result) =>
      result.action === "suggest_drill" &&
      result.decisionSignals.some((signal) => signal.includes("stuck")) &&
      result.confidence >= 0.65,
  },
  // Action: evaluate_answer. The policy should not keep asking follow-ups once
  // the transcript has enough candidate turns to produce a useful score.
  {
    name: "evaluates automatically after enough candidate turns",
    request: {
      mode: "System Design",
      difficulty: "Mid",
      prompt: "Design a URL shortener",
      messages: [
        message(
          "candidate",
          "First I would clarify requirements, scale, and latency constraints.",
        ),
        message(
          "candidate",
          "The API creates short codes, stores mappings in a database, and uses cache for hot redirects.",
        ),
        message(
          "candidate",
          "The main tradeoff is simple random codes versus coordinated uniqueness, because coordination adds complexity.",
        ),
      ],
    },
    expect: (result) =>
      result.action === "evaluate_answer" &&
      result.sessionStatus === "evaluated" &&
      Boolean(result.evaluation),
  },
  // Settings: rubric weights should affect the overall percentage while keeping
  // the individual 0-5 rubric scores visible for explanation.
  {
    name: "uses configured rubric weights for overall score",
    request: {
      mode: "System Design",
      difficulty: "Mid",
      prompt: "Design a URL shortener",
      forceEvaluate: true,
      rubricWeights: {
        Structure: 50,
        "Technical depth": 0,
        Tradeoffs: 0,
        "Communication clarity": 50,
        Completeness: 0,
      },
      messages: [
        message(
          "candidate",
          "First I would clarify requirements and constraints, then explain the request path clearly because the interviewer needs a simple sequence.",
        ),
      ],
    },
    expect: (result) => {
      if (!result.evaluation) {
        return false;
      }

      const scores = Object.fromEntries(
        result.evaluation.rubricScores.map((score) => [score.area, score.score]),
      );
      const expectedScore = Math.round(
        (((scores.Structure as number) / 5) * 50 +
          ((scores["Communication clarity"] as number) / 5) * 50),
      );

      return result.evaluation.overallScore === expectedScore;
    },
  },
  // Guardrail: exact company-question requests should become skill-equivalent
  // practice, not fabricated insider questions.
  {
    name: "routes exact company-question requests to a guardrailed drill",
    request: {
      mode: "System Design",
      difficulty: "Senior",
      prompt: "Practice a system design interview",
      messages: [
        message(
          "candidate",
          "Can you give me the exact Google interview question that was asked at Google?",
        ),
      ],
    },
    expect: (result) =>
      result.action === "suggest_drill" &&
      result.coachMessage.includes("cannot verify or fabricate") &&
      result.decisionSignals.some((signal) => signal.includes("guardrail")),
  },
  // Memory: saved weak areas should influence the next focus area when the
  // current answer gives enough room for a follow-up but no urgent drill.
  {
    name: "uses progress memory to target repeated weak areas",
    request: {
      mode: "System Design",
      difficulty: "Senior",
      prompt: "Design YouTube",
      progressMemory: {
        sessionsCompleted: 5,
        averageScore: 76,
        repeatedWeakAreas: [
          { area: "Tradeoffs", count: 3 },
          { area: "Completeness", count: 2 },
        ],
        lastSessionAt: new Date().toISOString(),
      },
      messages: [
        message(
          "candidate",
          "I would start with requirements and constraints, then design upload APIs, metadata storage, object storage, queues for transcoding, cache for hot metadata, and CDN playback. The database stores video metadata and users while workers process uploaded files asynchronously.",
        ),
      ],
    },
    expect: (result) =>
      result.action === "ask_follow_up" &&
      result.nextFocusArea === "Tradeoffs" &&
      result.decisionSignals.some((signal) => signal.includes("memory focus")),
  },
];

const results = cases.map((item) => {
  const result = runLocalAgentTurn(item.request);
  const hasDecisionMetadata =
    result.confidence > 0 &&
    result.decisionSignals.length > 0 &&
    result.actionScores[result.action] > 0;
  const passed =
    item.expect(result) &&
    hasDecisionMetadata &&
    result.guardrailNote.includes("not ground truth") &&
    result.guardrailNote.includes("will not fabricate");

  return {
    case: item.name,
    passed,
    action: result.action,
    tool: result.toolName,
    confidence: result.confidence,
    score: result.evaluation?.overallScore ?? "-",
    weakAreas: result.evaluation?.weakAreaTags.join(", ") ?? result.nextFocusArea ?? "-",
  };
});

console.table(results);

if (results.some((result) => !result.passed)) {
  process.exitCode = 1;
}
