"use client";

import { Plus, Save, X } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/interviewos/page-header";
import { useInterviewOS } from "@/components/interviewos/provider";
import { defaultRubric, focusAreas } from "@/lib/interview/catalog";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const {
    persistenceDetail,
    saveSettings,
    selectedFocusAreas,
    setSelectedFocusAreas,
    setTargetCompany,
    setTargetRole,
    targetCompany,
    targetRole,
  } = useInterviewOS();
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(defaultRubric.map((rubric) => [rubric.area, rubric.weight])),
  );
  const [newFocusArea, setNewFocusArea] = useState("");
  const [provider, setProvider] = useState("OpenAI");
  const [model, setModel] = useState("OPENAI_MODEL");
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);

  function toggleFocusArea(area: string) {
    setSelectedFocusAreas(
      selectedFocusAreas.includes(area)
        ? selectedFocusAreas.filter((item) => item !== area)
        : [...selectedFocusAreas, area],
    );
  }

  function addFocusArea() {
    const trimmed = newFocusArea.trim();
    if (!trimmed || selectedFocusAreas.includes(trimmed)) {
      return;
    }

    setSelectedFocusAreas([...selectedFocusAreas, trimmed]);
    setNewFocusArea("");
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Rubric & coaching preferences"
        description="Tune scoring weights, interview focus, target role, and model settings."
        actions={
          <button
            type="button"
            onClick={saveSettings}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Save className="size-4" aria-hidden="true" />
            Save settings
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Scoring rubric
            </p>
            <span
              className={cn(
                "rounded px-2 py-1 text-xs font-semibold",
                totalWeight === 100
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              Total: {totalWeight}%
            </span>
          </div>
          <div className="mt-5 space-y-5">
            {defaultRubric.map((rubric) => (
              <div key={rubric.area} className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{rubric.area}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {rubric.description}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-primary">
                    {weights[rubric.area]}%
                  </span>
                </div>
                <input
                  type="range"
                  value={weights[rubric.area]}
                  min={0}
                  max={50}
                  step={5}
                  onChange={(event) =>
                    setWeights((current) => ({
                      ...current,
                      [rubric.area]: Number(event.target.value),
                    }))
                  }
                  className="mt-4 w-full accent-primary"
                />
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Interview focus
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedFocusAreas.map((area) => (
                <span
                  key={area}
                  className="inline-flex items-center gap-2 rounded bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground"
                >
                  {area}
                  <button
                    type="button"
                    onClick={() => toggleFocusArea(area)}
                    title={`Remove ${area}`}
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={newFocusArea}
                onChange={(event) => setNewFocusArea(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addFocusArea();
                  }
                }}
                placeholder="Add a focus area"
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={addFocusArea}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
                title="Add focus area"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {focusAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleFocusArea(area)}
                  className={cn(
                    "min-h-9 rounded-md border px-3 text-left text-sm font-medium transition",
                    selectedFocusAreas.includes(area)
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {area}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              Target profile
            </p>
            <div className="mt-4 space-y-3">
              <LabelledInput label="Target role" value={targetRole} onChange={setTargetRole} />
              <LabelledInput
                label="Target company"
                value={targetCompany}
                onChange={setTargetCompany}
                placeholder="Optional"
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {persistenceDetail}
            </p>
          </section>

          <section className="rounded-md border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              AI provider
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium">Provider</label>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
                >
                  <option>OpenAI</option>
                  <option>Local fallback</option>
                  <option>Anthropic placeholder</option>
                </select>
              </div>
              <LabelledInput label="Model" value={model} onChange={setModel} mono />
              <p className="rounded-md bg-muted p-3 text-xs leading-5 text-muted-foreground">
                The backend route validates structured JSON and falls back locally when
                credentials are missing or model output is invalid.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function LabelledInput({
  label,
  mono,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  mono?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary",
          mono && "font-mono",
        )}
      />
    </div>
  );
}
