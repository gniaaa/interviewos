import { rubricAreas } from "../types";
import type { RubricArea } from "../types";
import { keywordSignals } from "./constants";

export function extractRubricSignals(text: string): Record<RubricArea, number> {
  const normalized = text.toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  // Keyword hits are a transparent proxy for local scoring. When OpenAI is
  // connected, this fallback still gives us a debuggable baseline.
  return Object.fromEntries(
    Object.entries(keywordSignals).map(([area, keywords]) => {
      const keywordHits = keywords.filter((keyword) =>
        normalized.includes(keyword),
      ).length;
      const lengthBonus = wordCount > 90 ? 1 : wordCount > 45 ? 0.5 : 0;
      return [area, keywordHits + lengthBonus];
    }),
  ) as Record<RubricArea, number>;
}

export const scoreSignals = extractRubricSignals;

export function normalizeCoverage(signals: Record<RubricArea, number>) {
  return Object.fromEntries(
    rubricAreas.map((area) => [
      area,
      roundToTwoDecimals(Math.min(1, signals[area] / 3)),
    ]),
  ) as Record<RubricArea, number>;
}

export function rubricAreasByCoverage(
  coverage: Record<RubricArea, number>,
  type: "covered" | "missing",
) {
  return rubricAreas.filter((area) =>
    type === "covered" ? coverage[area] >= 0.65 : coverage[area] < 0.35,
  );
}

export function findWeakestArea(signals: Record<RubricArea, number>) {
  return (Object.entries(signals).sort((a, b) => a[1] - b[1])[0]?.[0] ??
    "Tradeoffs") as RubricArea;
}

export function findStrongestArea(signals: Record<RubricArea, number>) {
  return (Object.entries(signals).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Structure") as RubricArea;
}

export function detectStuckAnswer(text: string) {
  const normalized = text.toLowerCase();
  return [
    "i don't know",
    "i do not know",
    "not sure",
    "i'm stuck",
    "im stuck",
    "no idea",
    "can't think",
    "can you give me a hint",
    "give me a hint",
    "help me",
  ].some((phrase) => normalized.includes(phrase));
}

export function detectExactCompanyQuestion(text: string) {
  const normalized = text.toLowerCase();
  return [
    "exact company interview",
    "exact google",
    "exact meta",
    "exact amazon",
    "exact netflix",
    "real google interview",
    "real meta interview",
    "real amazon interview",
    "asked at google",
    "asked at meta",
    "asked at amazon",
    "leaked interview question",
    "what does google ask",
    "what does meta ask",
  ].some((phrase) => normalized.includes(phrase));
}

export function clampPercent(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}
