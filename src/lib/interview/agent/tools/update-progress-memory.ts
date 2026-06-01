import { rubricAreas } from "../../types";
import type { Evaluation, ProgressMemory, RubricArea } from "../../types";

type UpdateProgressMemoryInput = {
  completedAt: string;
  evaluation: Evaluation;
  previousMemory?: ProgressMemory;
};

// Tool action: update_progress_memory.
// This returns the next compact memory snapshot; persisted sessions remain the
// source of truth, and the provider rebuilds memory from saved history later.
export function updateProgressMemoryTool({
  completedAt,
  evaluation,
  previousMemory,
}: UpdateProgressMemoryInput): ProgressMemory {
  const previousCompleted = previousMemory?.sessionsCompleted ?? 0;
  const sessionsCompleted = previousCompleted + 1;
  const previousAverageTotal =
    previousCompleted * (previousMemory?.averageScore ?? 0);
  const weakAreaCounts = new Map<RubricArea, number>();

  for (const item of previousMemory?.repeatedWeakAreas ?? []) {
    weakAreaCounts.set(item.area, item.count);
  }

  for (const area of evaluation.weakAreaTags) {
    weakAreaCounts.set(area, (weakAreaCounts.get(area) ?? 0) + 1);
  }

  return {
    sessionsCompleted,
    averageScore: Math.round(
      (previousAverageTotal + evaluation.overallScore) / sessionsCompleted,
    ),
    repeatedWeakAreas: [...weakAreaCounts.entries()]
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return rubricAreas.indexOf(a.area) - rubricAreas.indexOf(b.area);
      })
      .slice(0, 3),
    lastSessionAt: completedAt,
  };
}
