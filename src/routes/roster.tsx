import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useSettings } from "@/lib/settings";
import { getStudents } from "@/lib/sheets.functions";
import { useState } from "react";

export const Route = createFileRoute("/roster")({
  component: RosterPage,
  head: () => ({ meta: [{ title: "Roster" }] }),
});

function RosterPage() {
  const settings = useSettings();
  const [filter, setFilter] = useState("");
  const fetchStudents = useServerFn(getStudents);
  const q = useQuery({
    queryKey: ["students", settings.spreadsheetId, settings.studentsSheet],
    queryFn: () =>
      fetchStudents({
        data: { spreadsheetId: settings.spreadsheetId, sheetName: settings.studentsSheet },
      }),
    enabled: !!settings.spreadsheetId,
  });

  const filtered = q.data?.students.filter((s) => {
    const f = filter.toLowerCase();
    return !f || s.name.toLowerCase().includes(f) || s.studentId.toLowerCase().includes(f);
  });

  return (
    <AppShell title="Roster">
      {!settings.spreadsheetId ? (
        <p className="text-center text-sm text-muted-foreground">
          Set your spreadsheet ID in Settings.
        </p>
      ) : (
        <div className="space-y-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search name or ID…"
            className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          {q.error && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {(q.error as Error).message}
            </p>
          )}
          <ul className="space-y-2">
            {filtered?.map((s) => (
              <li
                key={s.studentId}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
              >
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.studentId}</p>
                </div>
              </li>
            ))}
            {q.data && filtered?.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No matches.
              </li>
            )}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
