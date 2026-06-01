import { rubricAreas } from "./types";
import type { InterviewSession, ProgressMemory, RubricArea } from "./types";

// Progress memory is intentionally compact. The agent does not need full
// transcripts from old sessions; it needs stable coaching signals it can use
// without leaking too much history into every model call.
export function buildProgressMemory(
  sessions: InterviewSession[],
): ProgressMemory {
  const evaluatedSessions = sessions
    .filter((session) => session.evaluation)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const recentSessions = evaluatedSessions.slice(0, 10);
  const scoreTotal = recentSessions.reduce(
    (sum, session) => sum + (session.evaluation?.overallScore ?? 0),
    0,
  );
  const weakAreaCounts = new Map<RubricArea, number>();

  for (const session of recentSessions) {
    for (const area of session.evaluation?.weakAreaTags ?? []) {
      weakAreaCounts.set(area, (weakAreaCounts.get(area) ?? 0) + 1);
    }
  }

  return {
    sessionsCompleted: evaluatedSessions.length,
    averageScore:
      recentSessions.length > 0
        ? Math.round(scoreTotal / recentSessions.length)
        : undefined,
    repeatedWeakAreas: [...weakAreaCounts.entries()]
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return rubricAreas.indexOf(a.area) - rubricAreas.indexOf(b.area);
      })
      .slice(0, 3),
    lastSessionAt: evaluatedSessions[0]?.createdAt,
  };
}
