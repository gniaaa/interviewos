import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { rubricAreas } from "@/lib/interview/types";
import type {
  Difficulty,
  Evaluation,
  InterviewMessage,
  InterviewMode,
  InterviewSession,
  MessageRole,
  RubricArea,
  RubricScore,
  SessionStatus,
} from "@/lib/interview/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cachedBrowserClient: SupabaseClient | null | undefined;

export type SupabaseSyncStatus = "checking" | "local" | "supabase" | "error";

export type SupabaseProfile = {
  targetRole: string;
  targetCompany: string;
  focusAreas: string[];
};

type SupabaseSessionRow = {
  id: string;
  mode: string;
  difficulty: string;
  prompt: string;
  status: string;
  duration_minutes: number | null;
  created_at: string;
};

type SupabaseMessageRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

type SupabaseRubricScoreRow = {
  area: string;
  score: number | string;
  max_score: number | string;
  rationale: string;
};

type SupabaseEvaluationRecord = {
  id: string;
  overall_score: number;
  strengths: string[];
  improvement_areas: string[];
  suggested_next_drill: string;
  follow_up_questions: string[];
  weak_area_tags: string[];
  rubric_scores: SupabaseRubricScoreRow[] | null;
};

type SupabaseSessionRecord = SupabaseSessionRow & {
  interview_messages: SupabaseMessageRow[] | null;
  evaluations: SupabaseEvaluationRecord[] | SupabaseEvaluationRecord | null;
};

type SupabaseProfileRow = {
  target_role: string;
  target_company: string;
  focus_areas: string[];
};

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function createSupabaseBrowserClient() {
  if (cachedBrowserClient !== undefined) {
    return cachedBrowserClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    cachedBrowserClient = null;
    return cachedBrowserClient;
  }

  cachedBrowserClient = createClient(supabaseUrl, supabaseAnonKey);

  return cachedBrowserClient;
}

// The MVP can run as a public demo by using Supabase anonymous users. RLS still
// protects each visitor's data because every row is scoped to auth.uid().
export async function getSupabaseUserConnection() {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError) {
    throw getUserError;
  }

  if (user) {
    return { supabase, userId: user.id };
  }

  const {
    data: { user: anonymousUser },
    error: signInError,
  } = await supabase.auth.signInAnonymously();

  if (signInError) {
    throw signInError;
  }

  if (!anonymousUser) {
    throw new Error("Supabase did not return a user for anonymous sign-in.");
  }

  return { supabase, userId: anonymousUser.id };
}

export async function loadInterviewSessionsFromSupabase() {
  const connection = await getSupabaseUserConnection();

  if (!connection) {
    return null;
  }

  const { data, error } = await connection.supabase
    .from("interview_sessions")
    .select(
      `
        id,
        mode,
        difficulty,
        prompt,
        status,
        duration_minutes,
        created_at,
        interview_messages (
          id,
          role,
          content,
          created_at
        ),
        evaluations (
          id,
          overall_score,
          strengths,
          improvement_areas,
          suggested_next_drill,
          follow_up_questions,
          weak_area_tags,
          rubric_scores (
            area,
            score,
            max_score,
            rationale
          )
        )
      `,
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return ((data ?? []) as SupabaseSessionRecord[]).map(mapSessionFromRecord);
}

export async function saveInterviewSessionToSupabase(session: InterviewSession) {
  const connection = await getSupabaseUserConnection();

  if (!connection) {
    return false;
  }

  const { supabase, userId } = connection;

  const { error: sessionError } = await supabase
    .from("interview_sessions")
    .upsert({
      id: session.id,
      user_id: userId,
      mode: session.mode,
      difficulty: session.difficulty,
      prompt: session.prompt,
      status: session.status,
      duration_minutes: session.durationMinutes ?? null,
      created_at: session.createdAt,
    });

  if (sessionError) {
    throw sessionError;
  }

  if (session.messages.length > 0) {
    // Messages only append during an interview, so upsert gives us retry-safe
    // persistence without deleting transcript rows first.
    const { error: messagesError } = await supabase
      .from("interview_messages")
      .upsert(
        session.messages.map((message) => ({
          id: message.id,
          session_id: session.id,
          user_id: userId,
          role: message.role,
          content: message.content,
          created_at: message.createdAt,
        })),
      );

    if (messagesError) {
      throw messagesError;
    }
  }

  if (session.evaluation) {
    await saveEvaluationToSupabase({
      evaluation: session.evaluation,
      sessionId: session.id,
      supabase,
      userId,
    });
  }

  return true;
}

export async function loadProfileFromSupabase() {
  const connection = await getSupabaseUserConnection();

  if (!connection) {
    return null;
  }

  const { data, error } = await connection.supabase
    .from("profiles")
    .select("target_role, target_company, focus_areas")
    .eq("user_id", connection.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const profile = data as SupabaseProfileRow;

  return {
    targetRole: profile.target_role,
    targetCompany: profile.target_company,
    focusAreas: profile.focus_areas,
  };
}

export async function saveProfileToSupabase(profile: SupabaseProfile) {
  const connection = await getSupabaseUserConnection();

  if (!connection) {
    return false;
  }

  const { error } = await connection.supabase.from("profiles").upsert({
    user_id: connection.userId,
    target_role: profile.targetRole,
    target_company: profile.targetCompany,
    focus_areas: profile.focusAreas,
  });

  if (error) {
    throw error;
  }

  return true;
}

async function saveEvaluationToSupabase({
  evaluation,
  sessionId,
  supabase,
  userId,
}: {
  evaluation: Evaluation;
  sessionId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const evaluationId = `evaluation_${sessionId}`;

  const { error: evaluationError } = await supabase.from("evaluations").upsert({
    id: evaluationId,
    session_id: sessionId,
    user_id: userId,
    overall_score: evaluation.overallScore,
    strengths: evaluation.strengths,
    improvement_areas: evaluation.improvementAreas,
    suggested_next_drill: evaluation.suggestedNextDrill,
    follow_up_questions: evaluation.followUpQuestions,
    weak_area_tags: evaluation.weakAreaTags,
  });

  if (evaluationError) {
    throw evaluationError;
  }

  const { error: scoresError } = await supabase
    .from("rubric_scores")
    .upsert(
      evaluation.rubricScores.map((score) => ({
        evaluation_id: evaluationId,
        user_id: userId,
        area: score.area,
        score: score.score,
        max_score: score.maxScore,
        rationale: score.rationale,
      })),
      { onConflict: "evaluation_id,area" },
    );

  if (scoresError) {
    throw scoresError;
  }
}

function mapSessionFromRecord(record: SupabaseSessionRecord): InterviewSession {
  const messages = (record.interview_messages ?? [])
    .map(mapMessageFromRecord)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const evaluation = mapEvaluationFromRecord(record.evaluations);

  return {
    id: record.id,
    mode: record.mode as InterviewMode,
    difficulty: record.difficulty as Difficulty,
    prompt: record.prompt,
    status: record.status as SessionStatus,
    createdAt: record.created_at,
    durationMinutes: record.duration_minutes ?? undefined,
    messages,
    evaluation,
  };
}

function mapMessageFromRecord(record: SupabaseMessageRow): InterviewMessage {
  return {
    id: record.id,
    role: record.role as MessageRole,
    content: record.content,
    createdAt: record.created_at,
  };
}

function mapEvaluationFromRecord(
  record: SupabaseSessionRecord["evaluations"],
): Evaluation | undefined {
  const evaluation = Array.isArray(record) ? record[0] : record;

  if (!evaluation) {
    return undefined;
  }

  return {
    overallScore: evaluation.overall_score,
    rubricScores: mapRubricScoresFromRecords(evaluation.rubric_scores ?? []),
    strengths: evaluation.strengths,
    improvementAreas: evaluation.improvement_areas,
    suggestedNextDrill: evaluation.suggested_next_drill,
    followUpQuestions: evaluation.follow_up_questions,
    weakAreaTags: evaluation.weak_area_tags as RubricArea[],
  };
}

function mapRubricScoresFromRecords(
  records: SupabaseRubricScoreRow[],
): RubricScore[] {
  return records
    .map((record) => ({
      area: record.area as RubricArea,
      score: Number(record.score),
      maxScore: Number(record.max_score),
      rationale: record.rationale,
    }))
    .sort(
      (a, b) =>
        rubricAreas.indexOf(a.area) - rubricAreas.indexOf(b.area),
    );
}

export const interviewTables = [
  "profiles",
  "interview_sessions",
  "interview_messages",
  "evaluations",
  "rubric_scores",
  "practice_goals",
] as const;
