"use client";

import { History, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/interviewos/page-header";
import { useInterviewOS } from "@/components/interviewos/provider";
import { skillTrendData, weakAreaInsights } from "@/lib/interview/catalog";
import type { InterviewSession } from "@/lib/interview/types";
import { difficulties, interviewModes } from "@/lib/interview/types";
import { formatScore, formatSessionDate } from "@/lib/utils";

export function ProgressPage() {
  const router = useRouter();
  const {
    changeMode,
    difficulty,
    mode,
    openSession,
    sessions,
    setDifficulty,
  } = useInterviewOS();
  const completedSessions = sessions.filter(
    (session) => session.status === "evaluated",
  );
  const filteredSessions = completedSessions.filter(
    (session) => session.mode === mode && session.difficulty === difficulty,
  );
  const visibleSessions =
    filteredSessions.length > 0 ? filteredSessions : completedSessions;

  function openHistorySession(session: InterviewSession) {
    openSession(session);
    router.push("/evaluation");
  }

  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title="Skill trends"
        description="Track rubric movement, weak-area tags, and completed practice history."
      />

      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Rubric trend
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Last six practice windows</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterSelect value={mode} onChange={changeMode} values={interviewModes} />
            <FilterSelect value={difficulty} onChange={setDifficulty} values={difficulties} />
          </div>
        </div>
        <SkillTrendChart />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_330px]">
        <SessionHistory sessions={visibleSessions} onOpenSession={openHistorySession} />
        <WeakAreaFrequency />
      </div>
    </>
  );
}

function FilterSelect<T extends string>({
  onChange,
  value,
  values,
}: {
  onChange: (value: T) => void;
  value: T;
  values: readonly T[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="h-9 rounded-md border border-input bg-card px-3 text-sm font-medium outline-none focus:border-primary"
    >
      {values.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}

function SkillTrendChart() {
  const width = 720;
  const height = 260;
  const padding = 32;
  const series = [
    { key: "structure", label: "Structure", color: "#0f766e" },
    { key: "depth", label: "Depth", color: "#4f46e5" },
    { key: "tradeoffs", label: "Tradeoffs", color: "#d97706" },
    { key: "communication", label: "Communication", color: "#be123c" },
  ] as const;

  function pointFor(value: number, index: number) {
    const x = padding + (index / (skillTrendData.length - 1)) * (width - padding * 2);
    const y = height - padding - (value / 100) * (height - padding * 2);
    return `${x},${y}`;
  }

  return (
    <div className="mt-5 overflow-hidden rounded-md bg-muted/40 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full" role="img">
        <title>Rubric skill trend</title>
        {[50, 65, 80, 95].map((line) => {
          const y = height - padding - (line / 100) * (height - padding * 2);
          return (
            <g key={line}>
              <line
                stroke="var(--color-border)"
                strokeDasharray="4 5"
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
              />
              <text fill="var(--color-muted-foreground)" fontSize="11" x="4" y={y + 4}>
                {line}
              </text>
            </g>
          );
        })}
        {series.map((item) => (
          <polyline
            key={item.key}
            fill="none"
            points={skillTrendData
              .map((point, index) => pointFor(point[item.key], index))
              .join(" ")}
            stroke={item.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        ))}
        {skillTrendData.map((point, index) => {
          const x = padding + (index / (skillTrendData.length - 1)) * (width - padding * 2);
          return (
            <text
              key={point.label}
              x={x}
              y={height - 7}
              fill="var(--color-muted-foreground)"
              fontSize="12"
              textAnchor="middle"
            >
              {point.label}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionHistory({
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
          Session history
        </p>
        <History className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
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
                <td className="px-4 py-3">{session.difficulty}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {session.durationMinutes ?? 25}m
                </td>
                <td className="px-4 py-3 text-right font-semibold">
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

function WeakAreaFrequency() {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          Weak area tags
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
  );
}
