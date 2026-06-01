"use client";

import {
  BarChart3,
  BrainCircuit,
  ClipboardCheck,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useInterviewOS } from "@/components/interviewos/provider";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Mock Interview", href: "/interview", icon: MessageSquareText },
  { label: "Evaluation", href: "/evaluation", icon: ClipboardCheck },
  { label: "Progress", href: "/progress", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { persistenceDetail, persistenceStatus } = useInterviewOS();
  const persistenceLabel =
    persistenceStatus === "checking"
      ? "Checking storage"
      : persistenceStatus === "supabase"
        ? "Supabase synced"
        : persistenceStatus === "error"
          ? "Local fallback"
          : "Local demo data";
  const persistenceClassName =
    persistenceStatus === "supabase"
      ? "bg-success/10 text-success"
      : persistenceStatus === "error"
        ? "bg-warning/10 text-warning"
        : "bg-muted text-muted-foreground";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card md:flex md:flex-col">
        <div className="border-b border-border px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BrainCircuit className="size-4" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">InterviewOS</p>
              <p className="text-xs text-muted-foreground">Interview prep, focused.</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4" aria-label="Workspace">
          <p className="px-3 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            Workspace
          </p>
          <div className="mt-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-md border border-border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Agentic MVP
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Stateful sessions, tool-style actions, structured rubric output.
            </p>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 md:px-6">
            <Link href="/" className="flex items-center gap-2 md:hidden">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <BrainCircuit className="size-4" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold">InterviewOS</span>
            </Link>
            <div className="hidden text-xs text-muted-foreground md:block">
              <span className="font-mono">Structured coach</span> · local fallback ready
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-xs font-semibold",
                  persistenceClassName,
                )}
                title={persistenceDetail}
              >
                {persistenceLabel}
              </span>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:hidden" aria-label="Mobile">
            {navItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-semibold",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  <item.icon className="size-3.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
