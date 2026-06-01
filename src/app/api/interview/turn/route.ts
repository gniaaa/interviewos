import { NextResponse } from "next/server";
import {
  hasInsufficientAnswerEvidence,
  runLocalAgentTurn,
} from "@/lib/interview/agent";
import { runOpenAiAgentTurn } from "@/lib/interview/openai-agent";
import { AgentTurnRequestSchema, AgentTurnSchema } from "@/lib/interview/schemas";
import type { AgentTurn, AgentTurnRequest } from "@/lib/interview/types";

// This route is the backend boundary for the coach. The UI sends the current
// transcript here, then receives one structured AgentTurn back.
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid or empty interview turn payload." },
      { status: 400 },
    );
  }

  const parsedRequest = AgentTurnRequestSchema.safeParse(body);

  // Validate user/app input before it reaches OpenAI or the local fallback.
  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "Invalid interview turn payload.",
        issues: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  if (shouldUseCalibratedLocalEvaluation(parsedRequest.data)) {
    return NextResponse.json(
      AgentTurnSchema.parse({
        ...runLocalAgentTurn(parsedRequest.data),
        source: process.env.OPENAI_API_KEY ? "openai_fallback" : "local",
      }),
    );
  }

  if (process.env.INTERVIEWOS_AGENT_SOURCE === "local") {
    // Browser flow tests force this path so UI behavior is stable even when a
    // developer has real OpenAI credentials in .env.local.
    return NextResponse.json(
      AgentTurnSchema.parse({
        ...runLocalAgentTurn(parsedRequest.data),
        source: "local",
      }),
    );
  }

  try {
    // Production path: ask OpenAI for a structured action. The response still
    // has to pass AgentTurnSchema before the UI trusts it.
    const openAiTurn = await runOpenAiAgentTurn(parsedRequest.data);

    if (openAiTurn) {
      const validatedOpenAiTurn = AgentTurnSchema.parse(openAiTurn);

      if (isValidTurnForRequest(parsedRequest.data, validatedOpenAiTurn)) {
        return NextResponse.json(validatedOpenAiTurn);
      }

      console.warn(
        "OpenAI agent turn did not satisfy the requested session transition, using local fallback.",
      );
    }
  } catch (error) {
    console.error("OpenAI agent turn failed, using local fallback.", error);
  }

  // Demo and safety path: deterministic code keeps the app usable without
  // credentials and gives us stable behavior for eval tests.
  const fallbackTurn = runLocalAgentTurn(parsedRequest.data);

  return NextResponse.json(
    AgentTurnSchema.parse({
      ...fallbackTurn,
      source: process.env.OPENAI_API_KEY ? "openai_fallback" : "local",
    }),
  );
}

function shouldUseCalibratedLocalEvaluation(request: AgentTurnRequest) {
  if (!request.forceEvaluate) {
    return false;
  }

  const candidateText = request.messages
    .filter((message) => message.role === "candidate")
    .map((message) => message.content)
    .join(" ");

  return hasInsufficientAnswerEvidence(candidateText);
}

function isValidTurnForRequest(
  request: AgentTurnRequest,
  turn: AgentTurn,
) {
  if (!request.forceEvaluate) {
    return true;
  }

  return (
    turn.action === "evaluate_answer" &&
    turn.toolName === "evaluate_answer" &&
    turn.toolCalls.includes("evaluate_answer") &&
    turn.toolCalls.includes("update_progress_memory") &&
    turn.sessionStatus === "evaluated" &&
    Boolean(turn.evaluation) &&
    Boolean(turn.progressMemory)
  );
}
