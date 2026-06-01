import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AgentTurnSchema } from "./schemas";
import type { AgentTurn, AgentTurnRequest } from "./types";

const instructions = `
You are InterviewOS, an AI interview coach for software engineering interview prep.
Maintain interview state from the provided transcript.
Choose exactly one action:
- ask_follow_up when the candidate should continue.
- evaluate_answer when there is enough evidence to score the session.
- suggest_drill when the candidate is stuck or asks for practice advice.
Before choosing, score all three actions from 0 to 100 using the transcript:
- ask_follow_up should rise when the session is active and one rubric area needs probing.
- evaluate_answer should rise when the user ended the session or there are enough candidate turns to score.
- suggest_drill should rise when the answer is very short, stuck, or better served by a smaller practice rep.
Score with coaching humility. Never claim scores are objective truth.
Do not fabricate exact company interview questions or claim a question came from a real company unless the user provided that source.
Return only the requested structured payload.
Set toolName to the same value as action.
Set source to "openai".
Include a concise decisionReason explaining why that action was chosen.
Include confidence from 0 to 1, actionScores for all actions, and decisionSignals with the concrete transcript evidence behind the decision.
`;

export async function runOpenAiAgentTurn(
  request: AgentTurnRequest,
): Promise<AgentTurn | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const response = await client.responses.parse({
    model,
    instructions,
    input: JSON.stringify({
      mode: request.mode,
      difficulty: request.difficulty,
      prompt: request.prompt,
      forceEvaluate: request.forceEvaluate ?? false,
      transcript: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
    text: {
      format: zodTextFormat(AgentTurnSchema, "interview_agent_turn"),
    },
  });

  const parsed = response.output_parsed;

  if (!parsed) {
    return null;
  }

  return {
    ...parsed,
    source: "openai",
  };
}
