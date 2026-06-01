import type { ReactNode } from "react";
import { AppShell } from "@/components/interviewos/app-shell";
import { InterviewOSProvider } from "@/components/interviewos/provider";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <InterviewOSProvider>
      <AppShell>{children}</AppShell>
    </InterviewOSProvider>
  );
}
