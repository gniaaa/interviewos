"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createCoachOpening, runLocalAgentTurn } from "@/lib/interview/agent";
import {
  defaultRubric,
  promptLibrary,
  seedSessions,
} from "@/lib/interview/catalog";
import { buildProgressMemory } from "@/lib/interview/progress-memory";
import type {
  AgentTurn,
  AgentTurnRequest,
  Difficulty,
  InterviewMessage,
  InterviewMode,
  InterviewSession,
  PromptItem,
  RubricArea,
  RubricWeights,
} from "@/lib/interview/types";
import {
  loadInterviewSessionsFromSupabase,
  loadProfileFromSupabase,
  saveInterviewSessionToSupabase,
  saveProfileToSupabase,
  type SupabaseSyncStatus,
} from "@/lib/supabase";
import { uid } from "@/lib/utils";

const sessionStorageKey = "interviewos_sessions_v1";
const actionNoticeDurationMs = 3_000;
const defaultRubricWeights = Object.fromEntries(
  defaultRubric.map((rubric) => [rubric.area, rubric.weight]),
) as RubricWeights;

type PendingAction =
  | "starting_session"
  | "submitting_answer"
  | "evaluating_session"
  | "saving_settings"
  | null;

type InterviewOSContextValue = {
  actionNotice: string | null;
  difficulty: Difficulty;
  input: string;
  isThinking: boolean;
  lastTurn: AgentTurn | null;
  latestEvaluation: InterviewSession["evaluation"];
  mode: InterviewMode;
  modePrompts: PromptItem[];
  persistenceDetail: string;
  persistenceStatus: SupabaseSyncStatus;
  pendingAction: PendingAction;
  promptId: string;
  rubricWeights: RubricWeights;
  selectedFocusAreas: string[];
  selectedPrompt: PromptItem;
  session: InterviewSession | null;
  sessions: InterviewSession[];
  targetCompany: string;
  targetRole: string;
  changeMode: (mode: InterviewMode) => void;
  endSession: () => Promise<void>;
  openSession: (session: InterviewSession) => void;
  saveSettings: () => Promise<void>;
  setDifficulty: (difficulty: Difficulty) => void;
  setInput: (input: string) => void;
  setPromptId: (promptId: string) => void;
  setSelectedFocusAreas: (areas: string[]) => void;
  setTargetCompany: (company: string) => void;
  setTargetRole: (role: string) => void;
  startSession: (promptOverride?: PromptItem) => void;
  submitAnswer: () => Promise<void>;
  updateRubricWeight: (area: RubricArea, weight: number) => void;
};

const InterviewOSContext = createContext<InterviewOSContextValue | null>(null);

export function InterviewOSProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<InterviewMode>("System Design");
  const [difficulty, setDifficulty] = useState<Difficulty>("Mid");
  const [promptId, setPromptId] = useState("url-shortener");
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [lastTurn, setLastTurn] = useState<AgentTurn | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>(seedSessions);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const actionNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const readyFrameRef = useRef<number | null>(null);
  const [rubricWeights, setRubricWeights] =
    useState<RubricWeights>(defaultRubricWeights);
  const [persistenceStatus, setPersistenceStatus] =
    useState<SupabaseSyncStatus>("checking");
  const [persistenceDetail, setPersistenceDetail] = useState(
    "Checking saved sessions",
  );
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([
    "Requirements gathering",
    "Tradeoff narration",
    "Concise technical summaries",
  ]);
  const [targetRole, setTargetRole] = useState("Frontend / full-stack SWE");
  const [targetCompany, setTargetCompany] = useState("");

  // Prompt options depend on the selected mode, so impossible mode/prompt pairs
  // never reach the agent payload.
  const modePrompts = useMemo(
    () => promptLibrary.filter((prompt) => prompt.mode === mode),
    [mode],
  );

  const selectedPrompt =
    modePrompts.find((prompt) => prompt.id === promptId) ?? modePrompts[0];
  const latestEvaluation = session?.evaluation ?? sessions[0]?.evaluation;
  const progressMemory = useMemo(
    () => buildProgressMemory(sessions),
    [sessions],
  );

  // Local storage keeps the app usable with no credentials. Supabase replaces
  // the same session list when the project keys and anonymous auth are ready.
  useEffect(() => {
    let cancelled = false;
    let storedSessionsTimeout: number | null = null;
    const storedSessions = window.localStorage.getItem(sessionStorageKey);

    if (storedSessions) {
      storedSessionsTimeout = window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        try {
          setSessions(JSON.parse(storedSessions));
        } catch {
          window.localStorage.removeItem(sessionStorageKey);
        }
      }, 0);
    }

    async function loadRemoteState() {
      try {
        const remoteSessions = await loadInterviewSessionsFromSupabase();
        const remoteProfile = await loadProfileFromSupabase();

        if (cancelled) {
          return;
        }

        if (remoteSessions) {
          if (remoteSessions.length > 0) {
            setSessions(remoteSessions);
          }

          setPersistenceStatus("supabase");
          setPersistenceDetail(
            remoteSessions.length > 0
              ? "Supabase sync on"
              : "Supabase ready; showing demo history",
          );
        } else {
          setPersistenceStatus("local");
          setPersistenceDetail("Local demo data");
        }

        if (remoteProfile) {
          setTargetRole(remoteProfile.targetRole);
          setTargetCompany(remoteProfile.targetCompany);
          setSelectedFocusAreas(remoteProfile.focusAreas);
          if (remoteProfile.rubricWeights) {
            setRubricWeights(remoteProfile.rubricWeights);
          }
        }
      } catch (error) {
        console.error("Supabase load failed; using local data.", error);

        if (!cancelled) {
          setPersistenceStatus("error");
          setPersistenceDetail("Supabase unavailable; local copy kept");
        }
      }
    }

    void loadRemoteState();

    return () => {
      cancelled = true;

      if (storedSessionsTimeout) {
        window.clearTimeout(storedSessionsTimeout);
      }
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(sessions.slice(0, 20)),
    );
  }, [sessions]);

  useEffect(() => {
    readyFrameRef.current = window.requestAnimationFrame(() => {
      readyFrameRef.current = window.requestAnimationFrame(() => {
        document.documentElement.dataset.interviewosReady = "true";
        readyFrameRef.current = null;
      });
    });

    return () => {
      delete document.documentElement.dataset.interviewosReady;

      if (actionNoticeTimeoutRef.current) {
        clearTimeout(actionNoticeTimeoutRef.current);
      }

      if (readyFrameRef.current !== null) {
        window.cancelAnimationFrame(readyFrameRef.current);
      }
    };
  }, []);

  function changeMode(nextMode: InterviewMode) {
    setMode(nextMode);
    setPromptId(
      promptLibrary.find((prompt) => prompt.mode === nextMode)?.id ?? promptId,
    );
  }

  function showActionNotice(message: string | null, durationMs = actionNoticeDurationMs) {
    if (actionNoticeTimeoutRef.current) {
      clearTimeout(actionNoticeTimeoutRef.current);
      actionNoticeTimeoutRef.current = null;
    }

    setActionNotice(message);

    if (!message || durationMs === 0) {
      return;
    }

    actionNoticeTimeoutRef.current = setTimeout(() => {
      setActionNotice((currentMessage) =>
        currentMessage === message ? null : currentMessage,
      );
      actionNoticeTimeoutRef.current = null;
    }, durationMs);
  }

  function startSession(promptOverride?: PromptItem) {
    const prompt = promptOverride ?? selectedPrompt;
    setPendingAction("starting_session");
    showActionNotice("Starting interview session...", 0);
    const nextSession: InterviewSession = {
      id: uid("session"),
      mode: prompt.mode,
      difficulty,
      prompt: prompt.title,
      status: "active",
      createdAt: new Date().toISOString(),
      messages: [createCoachOpening(prompt.mode, prompt.title)],
    };

    setMode(prompt.mode);
    setPromptId(prompt.id);
    setSession(nextSession);
    setLastTurn(null);
    setInput("");
    void persistSession(nextSession);
    setPendingAction(null);
    showActionNotice("Session started. The coach is ready for your answer.");
  }

  function openSession(nextSession: InterviewSession) {
    setSession(nextSession);
    setLastTurn(null);
  }

  async function submitAnswer() {
    if (!session || !input.trim() || isThinking) {
      return;
    }

    setPendingAction("submitting_answer");
    showActionNotice("Sending answer to the coach...", 0);
    const candidateMessage: InterviewMessage = {
      id: uid("msg"),
      role: "candidate",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...session.messages, candidateMessage];
    const nextSession = { ...session, messages: nextMessages };

    setSession(nextSession);
    setInput("");
    setIsThinking(true);

    const turn = await fetchAgentTurn({
      mode: nextSession.mode,
      difficulty: nextSession.difficulty,
      prompt: nextSession.prompt,
      messages: nextMessages,
      rubricWeights,
      progressMemory,
    });

    applyAgentTurn(nextSession, turn);
  }

  async function endSession() {
    if (!session || isThinking || session.status === "evaluated") {
      return;
    }

    setPendingAction("evaluating_session");
    showActionNotice("Building final evaluation...", 0);
    setIsThinking(true);

    const turn = await fetchAgentTurn({
      mode: session.mode,
      difficulty: session.difficulty,
      prompt: session.prompt,
      messages: session.messages,
      rubricWeights,
      progressMemory,
      forceEvaluate: true,
    });

    applyAgentTurn(session, turn);
  }

  function applyAgentTurn(baseSession: InterviewSession, turn: AgentTurn) {
    const coachMessage: InterviewMessage = {
      id: uid("msg"),
      role: "coach",
      content: turn.coachMessage,
      createdAt: new Date().toISOString(),
    };
    const updatedSession: InterviewSession = {
      ...baseSession,
      status: turn.sessionStatus,
      messages: [...baseSession.messages, coachMessage],
      evaluation: turn.evaluation ?? baseSession.evaluation,
    };

    setSession(updatedSession);
    setLastTurn(turn);
    setIsThinking(false);
    setPendingAction(null);
    showActionNotice(noticeForAgentTurn(turn));
    void persistSession(updatedSession);

    if (updatedSession.status === "evaluated") {
      setSessions((currentSessions) => [
        updatedSession,
        ...currentSessions.filter((item) => item.id !== updatedSession.id),
      ]);
    }
  }

  async function fetchAgentTurn(payload: AgentTurnRequest): Promise<AgentTurn> {
    try {
      const response = await fetch("/api/interview/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Interview agent request failed.");
      }

      return response.json();
    } catch {
      return runLocalAgentTurn(payload);
    }
  }

  async function persistSession(sessionToSave: InterviewSession) {
    try {
      const saved = await saveInterviewSessionToSupabase(sessionToSave);

      if (saved) {
        setPersistenceStatus("supabase");
        setPersistenceDetail("Supabase sync on");
      }
    } catch (error) {
      console.error("Supabase session save failed; local copy kept.", error);
      setPersistenceStatus("error");
      setPersistenceDetail("Supabase save failed; local copy kept");
    }
  }

  async function saveSettings() {
    if (pendingAction === "saving_settings") {
      return;
    }

    const totalRubricWeight = Object.values(rubricWeights).reduce(
      (sum, value) => sum + value,
      0,
    );

    if (totalRubricWeight !== 100) {
      showActionNotice("Rubric weights must total 100% before saving.");
      return;
    }

    setPendingAction("saving_settings");
    showActionNotice("Saving settings...", 0);

    try {
      const saved = await saveProfileToSupabase({
        targetRole,
        targetCompany,
        focusAreas: selectedFocusAreas,
        rubricWeights,
      });

      if (saved === "saved") {
        setPersistenceStatus("supabase");
        setPersistenceDetail("Settings saved to Supabase");
        showActionNotice("Settings saved to Supabase.");
      } else if (saved === "saved_without_rubric_weights") {
        setPersistenceStatus("supabase");
        setPersistenceDetail("Profile saved; rubric weights need migration");
        showActionNotice(
          "Profile saved. Apply the rubric weights migration to save sliders.",
        );
      } else {
        setPersistenceStatus("local");
        setPersistenceDetail("Settings kept locally for this session");
        showActionNotice("Settings kept locally for this session.");
      }
    } catch (error) {
      console.error("Supabase settings save failed.", error);
      setPersistenceStatus("error");
      setPersistenceDetail("Settings save failed; local values kept");
      showActionNotice("Settings save failed. Local values were kept.");
    } finally {
      setPendingAction(null);
    }
  }

  function updateRubricWeight(area: RubricArea, weight: number) {
    setRubricWeights((currentWeights) => ({
      ...currentWeights,
      [area]: weight,
    }));
  }

  return (
    <InterviewOSContext.Provider
      value={{
        actionNotice,
        difficulty,
        input,
        isThinking,
        lastTurn,
        latestEvaluation,
        mode,
        modePrompts,
        persistenceDetail,
        persistenceStatus,
        pendingAction,
        promptId,
        rubricWeights,
        selectedFocusAreas,
        selectedPrompt,
        session,
        sessions,
        targetCompany,
        targetRole,
        changeMode,
        endSession,
        openSession,
        saveSettings,
        setDifficulty,
        setInput,
        setPromptId,
        setSelectedFocusAreas,
        setTargetCompany,
        setTargetRole,
        startSession,
        submitAnswer,
        updateRubricWeight,
      }}
    >
      {children}
    </InterviewOSContext.Provider>
  );
}

function noticeForAgentTurn(turn: AgentTurn) {
  if (turn.action === "evaluate_answer") {
    return "Evaluation complete.";
  }

  if (turn.action === "suggest_drill") {
    return "Focused drill suggested.";
  }

  return "Follow-up ready.";
}

export function useInterviewOS() {
  const context = useContext(InterviewOSContext);

  if (!context) {
    throw new Error("useInterviewOS must be used inside InterviewOSProvider.");
  }

  return context;
}
