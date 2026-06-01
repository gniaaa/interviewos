"use client";

import { AlertCircle, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/interviewos/page-header";
import { useInterviewOS } from "@/components/interviewos/provider";
import type { Evaluation, InterviewSession } from "@/lib/interview/types";
import { formatScore } from "@/lib/utils";

export function EvaluationPage() {
  const { latestEvaluation, session, sessions, startSession } = useInterviewOS();
  const activeSession = session ?? sessions[0];

  if (!latestEvaluation || !activeSession) {
    return (
      <>
        <PageHeader
          eyebrow="Evaluation"
          title="No scored session yet"
          description="Complete a mock interview to generate rubric-based coaching feedback."
        />
        <div className="rounded-md border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No evaluation is available.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Evaluation"
        title="Session evaluation"
        description={`${activeSession.mode} · ${activeSession.prompt}`}
        actions={
          <button
            type="button"
            onClick={() => startSession()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-muted"
          >
            Run another
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <EvaluationSummary evaluation={latestEvaluation} session={activeSession} />
        <section className="space-y-4">
          <RubricTable evaluation={latestEvaluation} />
          <div className="grid gap-4 md:grid-cols-2">
            <InsightCard
              icon={CheckCircle2}
              title="Strengths"
              tone="success"
              items={latestEvaluation.strengths}
            />
            <InsightCard
              icon={AlertCircle}
              title="Improvement areas"
              tone="warning"
              items={latestEvaluation.improvementAreas}
            />
          </div>
          <section className="rounded-md border border-primary/25 bg-accent/55 p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Suggested next drill
            </p>
            <p className="mt-2 text-sm leading-6">{latestEvaluation.suggestedNextDrill}</p>
          </section>
          <section className="rounded-md border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Follow-up questions
            </p>
            <ol className="mt-3 space-y-2">
              {latestEvaluation.followUpQuestions.map((question, index) => (
                <li key={question} className="flex gap-3 text-sm leading-6">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {question}
                </li>
              ))}
            </ol>
          </section>
        </section>
      </div>
    </>
  );
}

function EvaluationSummary({
  evaluation,
  session,
}: {
  evaluation: Evaluation;
  session: InterviewSession;
}) {
  return (
    <aside className="space-y-4">
      <section className="rounded-md border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          Overall score
        </p>
        <div className="mt-4 flex items-end gap-2">
          <span className="text-6xl font-semibold tracking-normal">
            {evaluation.overallScore}
          </span>
          <span className="pb-2 text-sm text-muted-foreground">/ 100</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded border border-border px-2 py-1 text-xs">
            {session.difficulty}
          </span>
          <span className="rounded border border-border px-2 py-1 text-xs">
            {session.mode}
          </span>
        </div>
      </section>
      <section className="rounded-md border border-success/25 bg-success/10 p-4">
        <ShieldCheck className="size-5 text-success" aria-hidden="true" />
        <p className="mt-3 text-sm leading-6">
          Scores are coaching feedback, not an objective hiring verdict.
        </p>
      </section>
      <section className="rounded-md border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          Weak tags
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {evaluation.weakAreaTags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </section>
    </aside>
  );
}

function RubricTable({ evaluation }: { evaluation: Evaluation }) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          Rubric breakdown
        </p>
      </div>
      <div className="divide-y divide-border">
        {evaluation.rubricScores.map((score) => (
          <div key={score.area} className="grid gap-3 p-4 md:grid-cols-[180px_1fr_70px] md:items-center">
            <div>
              <p className="text-sm font-semibold">{score.area}</p>
              <p className="text-xs text-muted-foreground">
                {formatScore((score.score / score.maxScore) * 100)}
              </p>
            </div>
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(score.score / score.maxScore) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {score.rationale}
              </p>
            </div>
            <div className="text-right text-sm font-semibold">
              {score.score}/{score.maxScore}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InsightCard({
  icon: Icon,
  items,
  title,
  tone,
}: {
  icon: typeof CheckCircle2;
  items: string[];
  title: string;
  tone: "success" | "warning";
}) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon
          className={tone === "success" ? "size-4 text-success" : "size-4 text-warning"}
          aria-hidden="true"
        />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm leading-6">
            <span
              className={
                tone === "success"
                  ? "mt-2 size-1.5 shrink-0 rounded-full bg-success"
                  : "mt-2 size-1.5 shrink-0 rounded-full bg-warning"
              }
            />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
