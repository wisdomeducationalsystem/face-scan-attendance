import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px] shadow-primary" />
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 py-5">{children}</main>
      <BottomNav />
    </div>
  );
}
