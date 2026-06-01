import { NextResponse } from "next/server";
import { runLocalAgentTurn } from "@/lib/interview/agent";
import { runOpenAiAgentTurn } from "@/lib/interview/openai-agent";
import { AgentTurnRequestSchema, AgentTurnSchema } from "@/lib/interview/schemas";

// This route is the backend boundary for the coach. The UI sends the current
// transcript here, then receives one structured AgentTurn back.
export async function POST(request: Request) {
  const body = await request.json();
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

  try {
    // Production path: ask OpenAI for a structured action. The response still
    // has to pass AgentTurnSchema before the UI trusts it.
    const openAiTurn = await runOpenAiAgentTurn(parsedRequest.data);

    if (openAiTurn) {
      return NextResponse.json(AgentTurnSchema.parse(openAiTurn));
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
