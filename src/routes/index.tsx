import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { QrScanner } from "@/components/QrScanner";
import { useSettings } from "@/lib/settings";
import { appendAttendance, getStudents } from "@/lib/sheets.functions";
import { CheckCircle2, AlertCircle, Camera, Settings as Cog } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: ScannerPage,
  head: () => ({
    meta: [
      { title: "Scan Attendance" },
      { name: "description", content: "Scan student QR codes to mark attendance in your Google Sheet." },
    ],
  }),
});

type Feedback =
  | { kind: "success"; name: string; studentId: string; at: number }
  | { kind: "error"; message: string; at: number }
  | null;

function ScannerPage() {
  const settings = useSettings();
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [scanning, setScanning] = useState(false);
  const recentRef = useRef<Map<string, number>>(new Map());

  const append = useServerFn(appendAttendance);
  const fetchStudents = useServerFn(getStudents);

  useEffect(() => setMounted(true), []);

  const studentsQuery = useQuery({
    queryKey: ["students", settings.spreadsheetId, settings.studentsSheet],
    queryFn: () =>
      fetchStudents({
        data: { spreadsheetId: settings.spreadsheetId, sheetName: settings.studentsSheet },
      }),
    enabled: !!settings.spreadsheetId,
    staleTime: 60_000,
  });

  const lookup = useMemo(() => {
    const m = new Map<string, string>();
    studentsQuery.data?.students.forEach((s) => m.set(s.studentId.toLowerCase(), s.name));
    return m;
  }, [studentsQuery.data]);

  async function handleScan(text: string) {
    const code = text.trim();
    if (!code) return;
    const cooldown = settings.cooldownSeconds * 1000;
    const last = recentRef.current.get(code) ?? 0;
    if (Date.now() - last < cooldown) return;
    recentRef.current.set(code, Date.now());

    const name = lookup.get(code.toLowerCase());
    if (!name) {
      setFeedback({ kind: "error", message: `Unknown ID: ${code}`, at: Date.now() });
      return;
    }
    setScanning(true);
    try {
      await append({
        data: {
          spreadsheetId: settings.spreadsheetId,
          attendanceSheet: settings.attendanceSheet,
          studentId: code,
          name,
          status: "Present",
        },
      });
      setFeedback({ kind: "success", name, studentId: code, at: Date.now() });
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (e) {
      setFeedback({ kind: "error", message: (e as Error).message, at: Date.now() });
    } finally {
      setScanning(false);
    }
  }

  if (!settings.spreadsheetId) {
    return (
      <AppShell title="Attendance">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <Cog className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="text-base font-semibold">Connect your Google Sheet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your spreadsheet ID in Settings to start taking attendance.
          </p>
          <Link
            to="/settings"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Open Settings
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Scan Attendance">
      <div className="space-y-4">
        {!active ? (
          <button
            onClick={() => setActive(true)}
            className="flex aspect-square w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-card text-primary"
          >
            <Camera className="h-6 w-6" />
            <span className="font-medium">Start camera</span>
          </button>
        ) : (
          mounted && <QrScanner onScan={handleScan} paused={scanning} />
        )}

        {studentsQuery.isLoading && (
          <p className="text-center text-xs text-muted-foreground">Loading roster…</p>
        )}
        {studentsQuery.error && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-xs text-destructive">
            {(studentsQuery.error as Error).message}
          </p>
        )}
        {studentsQuery.data && (
          <p className="text-center text-xs text-muted-foreground">
            {studentsQuery.data.students.length} students loaded
          </p>
        )}

        {feedback?.kind === "success" && (
          <div
            key={feedback.at}
            className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/15 p-4 text-primary animate-in fade-in slide-in-from-bottom-2"
          >
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold">{feedback.name}</p>
              <p className="text-xs opacity-80">
                {feedback.studentId} marked present
              </p>
            </div>
          </div>
        )}
        {feedback?.kind === "error" && (
          <div
            key={feedback.at}
            className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/15 p-4 text-destructive animate-in fade-in slide-in-from-bottom-2"
          >
            <AlertCircle className="h-6 w-6 shrink-0" />
            <p className="text-sm">{feedback.message}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
