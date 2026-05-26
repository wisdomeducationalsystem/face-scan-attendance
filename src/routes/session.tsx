import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useSettings } from "@/lib/settings";
import { getTodayAttendance } from "@/lib/sheets.functions";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/session")({
  component: SessionPage,
  head: () => ({ meta: [{ title: "Today's Session" }] }),
});

function SessionPage() {
  const settings = useSettings();
  const fetchToday = useServerFn(getTodayAttendance);
  const q = useQuery({
    queryKey: ["today", settings.spreadsheetId, settings.attendanceSheet],
    queryFn: () =>
      fetchToday({
        data: {
          spreadsheetId: settings.spreadsheetId,
          attendanceSheet: settings.attendanceSheet,
        },
      }),
    enabled: !!settings.spreadsheetId,
    refetchInterval: 8000,
  });

  return (
    <AppShell title="Today's Session">
      {!settings.spreadsheetId ? (
        <p className="text-center text-sm text-muted-foreground">
          Set your spreadsheet ID in Settings.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {q.data?.entries.length ?? 0} present today
            </p>
            <button
              onClick={() => q.refetch()}
              className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs text-secondary-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <ul className="space-y-2">
            {q.data?.entries.slice().reverse().map((e) => (
              <li
                key={e.rowIndex}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
              >
                <div>
                  <p className="text-sm font-medium">{e.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{e.studentId}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
            {q.data && q.data.entries.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No scans yet today.
              </li>
            )}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
