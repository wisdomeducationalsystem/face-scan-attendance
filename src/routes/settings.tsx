import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { loadSettings, saveSettings, type Settings } from "@/lib/settings";
import { getSpreadsheetMeta } from "@/lib/sheets.functions";
import { Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings" }] }),
});

function SettingsPage() {
  const [s, setS] = useState<Settings>({
    spreadsheetId: "",
    studentsSheet: "Students",
    attendanceSheet: "Attendance",
    cooldownSeconds: 60,
  });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const meta = useServerFn(getSpreadsheetMeta);

  useEffect(() => setS(loadSettings()), []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await meta({ data: { spreadsheetId: s.spreadsheetId } });
      setTestResult(`✓ Connected to "${result.title}" — sheets: ${result.sheets.map((x: { title: string }) => x.title).join(", ")}`);
    } catch (e) {
      setTestResult(`✗ ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <AppShell title="Settings">
      <div className="space-y-5">
        <Field label="Google Sheet ID or URL" hint="Paste the full URL or just the ID between /d/ and /edit.">
          <input
            value={s.spreadsheetId}
            onChange={(e) => update("spreadsheetId", e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Students tab">
            <input
              value={s.studentsSheet}
              onChange={(e) => update("studentsSheet", e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label="Attendance tab">
            <input
              value={s.attendanceSheet}
              onChange={(e) => update("attendanceSheet", e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
        </div>

        <Field label="Duplicate-scan cooldown (seconds)">
          <input
            type="number"
            min={0}
            value={s.cooldownSeconds}
            onChange={(e) => update("cooldownSeconds", Number(e.target.value))}
            className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground"
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Saved" : "Save"}
          </button>
          <button
            onClick={testConnection}
            disabled={!s.spreadsheetId || testing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {testing && <Loader2 className="h-4 w-4 animate-spin" />}
            Test
          </button>
        </div>

        {testResult && (
          <p className="rounded-xl border border-border bg-card p-3 text-xs">
            {testResult}
          </p>
        )}

        <div className="rounded-xl border border-border bg-card/60 p-4 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Sheet format</p>
          <p>Your <b>Students</b> tab needs columns named <b>StudentID</b> and <b>Name</b> (row 1 headers). The <b>Attendance</b> tab is created automatically with columns Timestamp, Date, StudentID, Name, Status.</p>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  );
}
