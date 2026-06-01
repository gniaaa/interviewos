import { z } from "zod";
import { difficulties, interviewModes, rubricAreas } from "./types";

// These schemas mirror the TypeScript types, but run at request time. They keep
// malformed UI payloads or malformed model outputs from entering app state.
export const InterviewModeSchema = z.enum(interviewModes);
export const DifficultySchema = z.enum(difficulties);
export const RubricAreaSchema = z.enum(rubricAreas);

const RubricWeightsSchema = z.object({
  Structure: z.number().min(0).max(100),
  "Technical depth": z.number().min(0).max(100),
  Tradeoffs: z.number().min(0).max(100),
  "Communication clarity": z.number().min(0).max(100),
  Completeness: z.number().min(0).max(100),
});

export const InterviewMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["coach", "candidate", "system"]),
  content: z.string(),
  createdAt: z.string(),
});

export const RubricScoreSchema = z.object({
  area: RubricAreaSchema,
  score: z.number().min(0).max(5),
  maxScore: z.literal(5),
  rationale: z.string(),
});

export const EvaluationSchema = z.object({
  overallScore: z.number().min(0).max(100),
  rubricScores: z.array(RubricScoreSchema).length(5),
  strengths: z.array(z.string()).min(1),
  improvementAreas: z.array(z.string()).min(1),
  suggestedNextDrill: z.string(),
  followUpQuestions: z.array(z.string()).min(1),
  weakAreaTags: z.array(RubricAreaSchema).min(1),
});

export const ProgressMemorySchema = z.object({
  sessionsCompleted: z.number().int().min(0),
  averageScore: z.number().min(0).max(100).optional(),
  repeatedWeakAreas: z
    .array(
      z.object({
        area: RubricAreaSchema,
        count: z.number().int().min(1),
      }),
    )
    .max(5),
  lastSessionAt: z.string().optional(),
});

export const AgentTurnRequestSchema = z.object({
  mode: InterviewModeSchema,
  difficulty: DifficultySchema,
  prompt: z.string().min(3),
  messages: z.array(InterviewMessageSchema),
  rubricWeights: RubricWeightsSchema.optional(),
  progressMemory: ProgressMemorySchema.optional(),
  forceEvaluate: z.boolean().optional(),
});

const AgentActionSchema = z.enum([
  "ask_follow_up",
  "evaluate_answer",
  "suggest_drill",
]);

const AgentActionScoresSchema = z.object({
  ask_follow_up: z.number().min(0).max(100),
  evaluate_answer: z.number().min(0).max(100),
  suggest_drill: z.number().min(0).max(100),
});

// OpenAI and the local fallback must both return this exact shape. That makes
// the UI indifferent to whether a turn came from a model or deterministic code.
export const AgentTurnSchema = z.object({
  action: AgentActionSchema,
  toolName: AgentActionSchema,
  decisionReason: z.string(),
  confidence: z.number().min(0).max(1),
  decisionSignals: z.array(z.string()).min(1),
  actionScores: AgentActionScoresSchema,
  coachMessage: z.string(),
  sessionStatus: z.enum(["active", "evaluated"]),
  evaluation: EvaluationSchema.nullable(),
  nextFocusArea: RubricAreaSchema.nullable(),
  source: z.enum(["local", "openai", "openai_fallback"]),
  guardrailNote: z.string(),
});

export type ParsedAgentTurn = z.infer<typeof AgentTurnSchema>;
