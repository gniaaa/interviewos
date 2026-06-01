import type { AgentAction, AgentTurn } from "../../types";
import type { AgentToolInput } from "../types";
import { askFollowUpTool } from "./ask-follow-up";
import { evaluateAnswerTool } from "./evaluate-answer";
import { suggestDrillTool } from "./suggest-drill";
import { updateProgressMemoryTool } from "./update-progress-memory";

export { askFollowUpTool, evaluateAnswerTool, suggestDrillTool, updateProgressMemoryTool };

export const interviewAgentTools: Record<
  AgentAction,
  (input: AgentToolInput) => AgentTurn
> = {
  ask_follow_up: askFollowUpTool,
  evaluate_answer: evaluateAnswerTool,
  suggest_drill: suggestDrillTool,
};
