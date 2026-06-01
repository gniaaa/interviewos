"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createCoachOpening, runLocalAgentTurn } from "@/lib/interview/agent";
import { promptLibrary, seedSessions } from "@/lib/interview/catalog";
import type {
  AgentTurn,
  AgentTurnRequest,
  Difficulty,
  InterviewMessage,
  InterviewMode,
  InterviewSession,
  PromptItem,
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

type InterviewOSContextValue = {
  difficulty: Difficulty;
  input: string;
  isThinking: boolean;
  lastTurn: AgentTurn | null;
  latestEvaluation: InterviewSession["evaluation"];
  mode: InterviewMode;
  modePrompts: PromptItem[];
  persistenceDetail: string;
  persistenceStatus: SupabaseSyncStatus;
  promptId: string;
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
};

const InterviewOSContext = createContext<InterviewOSContextValue | null>(null);

export function InterviewOSProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mode, setMode] = useState<InterviewMode>("System Design");
  const [difficulty, setDifficulty] = useState<Difficulty>("Mid");
  const [promptId, setPromptId] = useState("url-shortener");
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [lastTurn, setLastTurn] = useState<AgentTurn | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>(seedSessions);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
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

  // Local storage keeps the app usable with no credentials. Supabase replaces
  // the same session list when the project keys and anonymous auth are ready.
  useEffect(() => {
    const storedSessions = window.localStorage.getItem(sessionStorageKey);
    if (storedSessions) {
      queueMicrotask(() => {
        try {
          setSessions(JSON.parse(storedSessions));
        } catch {
          window.localStorage.removeItem(sessionStorageKey);
        }
      });
    }

    let cancelled = false;

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
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(sessions.slice(0, 20)),
    );
  }, [sessions]);

  function changeMode(nextMode: InterviewMode) {
    setMode(nextMode);
    setPromptId(
      promptLibrary.find((prompt) => prompt.mode === nextMode)?.id ?? promptId,
    );
  }

  function startSession(promptOverride?: PromptItem) {
    const prompt = promptOverride ?? selectedPrompt;
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
    router.push("/interview");
  }

  function openSession(nextSession: InterviewSession) {
    setSession(nextSession);
    setLastTurn(null);
    router.push("/evaluation");
  }

  async function submitAnswer() {
    if (!session || !input.trim() || isThinking) {
      return;
    }

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
    });

    applyAgentTurn(nextSession, turn);
  }

  async function endSession() {
    if (!session || isThinking) {
      return;
    }

    setIsThinking(true);

    const turn = await fetchAgentTurn({
      mode: session.mode,
      difficulty: session.difficulty,
      prompt: session.prompt,
      messages: session.messages,
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
    void persistSession(updatedSession);

    if (updatedSession.status === "evaluated") {
      setSessions((currentSessions) => [
        updatedSession,
        ...currentSessions.filter((item) => item.id !== updatedSession.id),
      ]);
      router.push("/evaluation");
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
    try {
      const saved = await saveProfileToSupabase({
        targetRole,
        targetCompany,
        focusAreas: selectedFocusAreas,
      });

      if (saved) {
        setPersistenceStatus("supabase");
        setPersistenceDetail("Settings saved to Supabase");
      } else {
        setPersistenceStatus("local");
        setPersistenceDetail("Settings kept locally for this session");
      }
    } catch (error) {
      console.error("Supabase settings save failed.", error);
      setPersistenceStatus("error");
      setPersistenceDetail("Settings save failed; local values kept");
    }
  }

  return (
    <InterviewOSContext.Provider
      value={{
        difficulty,
        input,
        isThinking,
        lastTurn,
        latestEvaluation,
        mode,
        modePrompts,
        persistenceDetail,
        persistenceStatus,
        promptId,
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
      }}
    >
      {children}
    </InterviewOSContext.Provider>
  );
}

export function useInterviewOS() {
  const context = useContext(InterviewOSContext);

  if (!context) {
    throw new Error("useInterviewOS must be used inside InterviewOSProvider.");
  }

  return context;
}
