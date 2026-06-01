"use client";

import {
  Activity,
  CalendarCheck2,
  ChevronRight,
  Flame,
  Gauge,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/interviewos/page-header";
import { useInterviewOS } from "@/components/interviewos/provider";
import {
  practiceStats,
  promptLibrary,
  weakAreaInsights,
  weeklyActivity,
} from "@/lib/interview/catalog";
import type { InterviewSession } from "@/lib/interview/types";
import { cn, formatScore, formatSessionDate } from "@/lib/utils";

export function DashboardPage() {
  const { openSession, sessions, startSession } = useInterviewOS();
  const router = useRouter();

  function startRecommended() {
    startSession(
      promptLibrary.find((prompt) => prompt.title === practiceStats.recommendedPrompt),
    );
    router.push("/interview");
  }

  function openRecentSession(session: InterviewSession) {
    openSession(session);
    router.push("/evaluation");
  }

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Practice overview"
        description="A compact view of consistency, weak areas, and the next useful practice rep."
        actions={
          <button
            type="button"
            onClick={startRecommended}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Start recommended
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Flame} label="Weekly streak" value={`${practiceStats.streak} days`} hint="Best: 12 days" />
            <Stat icon={Activity} label="Sessions" value={String(practiceStats.sessionsCompleted)} hint="+6 this week" />
            <Stat icon={Gauge} label="Average score" value={formatScore(practiceStats.averageScore)} hint="Last 10 sessions" />
            <Stat icon={TrendingUp} label="Trend" value={`+${practiceStats.monthlyTrend}`} hint="vs. previous month" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <WeeklyActivity />
            <WeakAreaList />
          </div>

          <section className="rounded-md border border-primary/25 bg-accent/55 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Sparkles className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Recommended next practice</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {practiceStats.recommendedMode} · {practiceStats.recommendedDifficulty} ·{" "}
                    <span className="text-foreground">{practiceStats.recommendedPrompt}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={startRecommended}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Start drill
              </button>
            </div>
          </section>

          <RecentSessionsTable sessions={sessions} onOpenSession={openRecentSession} />
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Agent loop
            </p>
            <div className="mt-3 space-y-2">
              {[
                "Maintain transcript state",
                "Choose follow-up, drill, or evaluation",
                "Return structured rubric output",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                Weak area frequency
              </p>
              <Target className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-4 space-y-3">
              {weakAreaInsights.map((item, index) => (
                <div key={item.tag}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="font-medium">{item.tag}</span>
                    <span className="text-muted-foreground">{item.count}x</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-warning"
                      style={{ width: `${92 - index * 14}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function Stat({
  hint,
  icon: Icon,
  label,
  value,
}: {
  hint: string;
  icon: typeof CalendarCheck2;
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          {label}
        </span>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </section>
  );
}

function WeeklyActivity() {
  const max = Math.max(...weeklyActivity.map((item) => item.sessions), 1);

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        Weekly activity
      </p>
      <div className="mt-4 flex h-48 items-end gap-3 rounded-md bg-muted/45 px-4 py-3">
        {weeklyActivity.map((item) => (
          <div key={item.day} className="flex h-full flex-1 flex-col justify-end gap-2">
            <div
              className="rounded-t bg-primary"
              style={{ height: `${Math.max((item.sessions / max) * 100, 7)}%` }}
            />
            <div className="text-center text-xs font-medium text-muted-foreground">
              {item.day}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WeakAreaList() {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        Top coaching themes
      </p>
      <div className="mt-4 space-y-2">
        {weakAreaInsights.map((item) => (
          <div
            key={item.tag}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold">{item.tag}</p>
              <p className="text-xs text-muted-foreground">{item.area}</p>
            </div>
            <span className="rounded bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
              {item.count}x
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentSessionsTable({
  onOpenSession,
  sessions,
}: {
  onOpenSession: (session: InterviewSession) => void;
  sessions: InterviewSession[];
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          Recent sessions
        </p>
        <span className="text-xs text-muted-foreground">{sessions.length} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/60 text-left text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Prompt</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Difficulty</th>
              <th className="px-4 py-2">Duration</th>
              <th className="px-4 py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr
                key={session.id}
                className="cursor-pointer border-t border-border hover:bg-muted/40"
                onClick={() => onOpenSession(session)}
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {formatSessionDate(session.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium">{session.prompt}</td>
                <td className="px-4 py-3 text-muted-foreground">{session.mode}</td>
                <td className="px-4 py-3">
                  <span className="rounded border border-border px-2 py-1 text-xs">
                    {session.difficulty}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {session.durationMinutes ?? 25}m
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-semibold",
                    (session.evaluation?.overallScore ?? 0) >= 80
                      ? "text-success"
                      : "text-foreground",
                  )}
                >
                  {formatScore(session.evaluation?.overallScore ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
