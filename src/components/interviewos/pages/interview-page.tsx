"use client";

import {
  Bot,
  CheckCircle2,
  Loader2,
  RotateCw,
  Send,
  SlidersHorizontal,
  StopCircle,
  Trash2,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PageHeader } from "@/components/interviewos/page-header";
import { useInterviewOS } from "@/components/interviewos/provider";
import type {
  AgentAction,
  AgentTurn,
  InterviewMessage,
  ProgressMemory,
} from "@/lib/interview/types";
import { difficulties, interviewModes } from "@/lib/interview/types";
import { cn, formatAgentAction } from "@/lib/utils";

export function InterviewPage() {
  const {
    actionNotice,
    changeMode,
    discardSession,
    difficulty,
    endSession,
    input,
    isThinking,
    lastTurn,
    mode,
    modePrompts,
    pendingAction,
    promptId,
    selectedPrompt,
    session,
    setDifficulty,
    setInput,
    setPromptId,
    startSession,
    submitAnswer,
  } = useInterviewOS();
  const router = useRouter();
  const isSubmitting = pendingAction === "submitting_answer";
  const isEvaluating = pendingAction === "evaluating_session";
  const isStarting = pendingAction === "starting_session";
  const isAbandoning = pendingAction === "abandoning_session";
  const isSessionActionPending = isStarting || isEvaluating || isAbandoning;
  const canSubmit =
    Boolean(session) &&
    Boolean(input.trim()) &&
    !isThinking &&
    session?.status === "active";

  useEffect(() => {
    if (session?.status === "evaluated") {
      router.push("/evaluation");
    }
  }, [router, session?.status]);

  return (
    <>
      <PageHeader
        eyebrow="Mock Interview"
        title={session?.prompt ?? "Practice workspace"}
        description="Configure a session, answer out loud or in writing, and let the coach choose the next action."
        actions={
          session ? (
            <>
              <button
                type="button"
                onClick={() => startSession()}
                disabled={isThinking || isSessionActionPending}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCw className="size-4" aria-hidden="true" />
                Reset
              </button>
              <button
                type="button"
                onClick={discardSession}
                disabled={isThinking || isSessionActionPending || session.status !== "active"}
                aria-busy={isAbandoning}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAbandoning ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
                {isAbandoning ? "Discarding..." : "Discard"}
              </button>
              <button
                type="button"
                onClick={endSession}
                disabled={isThinking || isSessionActionPending || session.status !== "active"}
                aria-busy={isEvaluating}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-3 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isEvaluating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <StopCircle className="size-4" aria-hidden="true" />
                )}
                {isEvaluating
                    ? "Evaluating..."
                    : session.status === "evaluated"
                      ? "Evaluated"
                      : "End & evaluate"}
              </button>
            </>
          ) : null
        }
      />

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/45 px-4 py-3">
          <ConfigSelect label="Mode" value={mode} onChange={(value) => changeMode(value)}>
            {interviewModes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </ConfigSelect>
          <ConfigSelect
            label="Difficulty"
            value={difficulty}
            onChange={(value) => setDifficulty(value)}
          >
            {difficulties.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </ConfigSelect>
          <ConfigSelect label="Prompt" value={promptId} onChange={setPromptId} wide>
            {modePrompts.map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.title}
              </option>
            ))}
          </ConfigSelect>
          <button
            type="button"
            onClick={() => startSession()}
            disabled={isThinking || isSessionActionPending}
            aria-busy={isStarting}
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStarting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            )}
            {isStarting ? "Starting..." : "Begin interview"}
          </button>
        </div>

        <div className="grid min-h-[650px] lg:grid-cols-[1fr_300px]">
          <section className="flex min-h-[650px] flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-5">
              {!session ? (
                <EmptyInterview prompt={selectedPrompt.title} />
              ) : (
                <div className="mx-auto max-w-3xl space-y-5">
                  {session.messages.map((message) => (
                    <MessageRow key={message.id} message={message} />
                  ))}
                  {isThinking && (
                    <MessageRow
                      message={{
                        id: "thinking",
                        role: "coach",
                        content: isEvaluating
                          ? "Building your final evaluation..."
                          : "Reviewing your answer...",
                        createdAt: new Date().toISOString(),
                      }}
                      thinking
                    />
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-border bg-background px-4 py-3">
              <div className="mx-auto max-w-3xl">
                {actionNotice && (
                  <div className="mb-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                    {actionNotice}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) {
                        return;
                      }

                      if (event.key !== "Enter" || event.shiftKey) {
                        return;
                      }

                      event.preventDefault();

                      void submitAnswer();
                    }}
                    disabled={!session || isThinking || session.status !== "active"}
                    placeholder={
                      !session
                        ? "Begin an interview first"
                        : session.status === "evaluated"
                          ? "This session has been evaluated"
                          : session.status === "abandoned"
                            ? "This session was discarded"
                            : "Type your answer as the candidate..."
                    }
                    className="min-h-24 flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-muted/60"
                  />
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={!canSubmit}
                    aria-busy={isSubmitting}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="size-4" aria-hidden="true" />
                    )}
                    {isSubmitting ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside className="border-t border-border bg-muted/25 p-4 lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Agent state
            </p>
            {lastTurn ? (
              <div className="mt-3 space-y-3">
                <InfoRow label="Decision" value={formatAgentAction(lastTurn.action)} />
                <InfoRow label="Primary tool" value={formatAgentAction(lastTurn.toolName)} />
                <InfoRow label="Source" value={lastTurn.source.replace("_", " ")} />
                <InfoRow
                  label="Confidence"
                  value={`${Math.round(lastTurn.confidence * 100)}%`}
                />
                {lastTurn.nextFocusArea && (
                  <InfoRow label="Focus" value={lastTurn.nextFocusArea} />
                )}
                <p className="rounded-md border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
                  {lastTurn.decisionReason}
                </p>
                <ToolCallList calls={lastTurn.toolCalls} />
                {lastTurn.progressMemory && (
                  <ProgressMemoryPreview memory={lastTurn.progressMemory} />
                )}
                <ActionScoreList scores={lastTurn.actionScores} />
                <DecisionSignals signals={lastTurn.decisionSignals} />
              </div>
            ) : (
              <p className="mt-3 rounded-md border border-border bg-card p-3 text-sm leading-6 text-muted-foreground">
                Start a session and send an answer to see the agent choose a tool.
              </p>
            )}

            <div className="mt-5 rounded-md border border-border bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                Prompt context
              </p>
              <p className="mt-2 text-sm font-semibold">{selectedPrompt.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {mode} · {difficulty}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function ConfigSelect<T extends string>({
  children,
  label,
  onChange,
  value,
  wide,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: T) => void;
  value: T;
  wide?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn(
          "h-8 rounded-md border border-input bg-card px-2 text-xs font-medium outline-none focus:border-primary",
          wide ? "w-[260px]" : "w-[150px]",
        )}
      >
        {children}
      </select>
    </label>
  );
}

function EmptyInterview({ prompt }: { prompt: string }) {
  return (
    <div className="flex min-h-[480px] items-center justify-center">
      <div className="max-w-xl rounded-md border border-border bg-background p-5">
        <span className="rounded border border-border px-2 py-1 text-xs font-semibold text-muted-foreground">
          Ready
        </span>
        <h2 className="mt-4 text-lg font-semibold">{prompt}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Begin the interview to start the transcript. The coach will ask a targeted
          opening question, then choose follow-ups, drills, or evaluation from your answers.
        </p>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  thinking,
}: {
  message: InterviewMessage;
  thinking?: boolean;
}) {
  const isCoach = message.role === "coach";

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          isCoach ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
        )}
      >
        {isCoach ? <Bot className="size-4" /> : <User className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          {isCoach ? "Coach" : "Candidate"}
        </div>
        <div
          className={cn(
            "mt-1 whitespace-pre-wrap text-sm leading-7",
            thinking ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {thinking ? (
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
            </span>
          ) : (
            message.content
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1 font-semibold">
        {label === "Decision" && <CheckCircle2 className="size-3.5 text-success" />}
        {value}
      </span>
    </div>
  );
}

function ToolCallList({ calls }: { calls: AgentTurn["toolCalls"] }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        Tool calls
      </p>
      <ol className="mt-2 space-y-1.5">
        {calls.map((call, index) => (
          <li
            key={`${call}_${index}`}
            className="flex items-center justify-between gap-3 text-xs leading-5"
          >
            <span className="text-muted-foreground">Step {index + 1}</span>
            <span className="font-medium">{formatAgentAction(call)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ProgressMemoryPreview({ memory }: { memory: ProgressMemory }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        Updated memory
      </p>
      <div className="mt-2 space-y-1.5 text-xs leading-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Completed</span>
          <span className="font-medium">{memory.sessionsCompleted}</span>
        </div>
        {typeof memory.averageScore === "number" && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Average</span>
            <span className="font-medium">{memory.averageScore}%</span>
          </div>
        )}
        {memory.repeatedWeakAreas.length > 0 && (
          <p className="pt-1 text-muted-foreground">
            {memory.repeatedWeakAreas
              .map((item) => `${item.area} x${item.count}`)
              .join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

const agentActions: AgentAction[] = [
  "ask_follow_up",
  "evaluate_answer",
  "suggest_drill",
];

function ActionScoreList({ scores }: { scores: AgentTurn["actionScores"] }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        Planner scores
      </p>
      <div className="mt-3 space-y-3">
        {agentActions.map((action) => (
          <div key={action}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium">{formatAgentAction(action)}</span>
              <span className="text-muted-foreground">{scores[action]}/100</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${scores[action]}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionSignals({ signals }: { signals: string[] }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        Evidence
      </p>
      <ul className="mt-2 space-y-1.5">
        {signals.slice(0, 6).map((signal) => (
          <li key={signal} className="text-xs leading-5 text-muted-foreground">
            {signal}
          </li>
        ))}
      </ul>
    </div>
  );
}
