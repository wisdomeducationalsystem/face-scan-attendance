import { useEffect, useState } from "react";

export type Settings = {
  spreadsheetId: string;
  studentsSheet: string;
  attendanceSheet: string;
  cooldownSeconds: number;
};

const DEFAULTS: Settings = {
  spreadsheetId: "",
  studentsSheet: "Students",
  attendanceSheet: "Attendance",
  cooldownSeconds: 60,
};

const KEY = "attendance.settings.v1";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("attendance.settings.changed"));
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    setSettings(loadSettings());
    const onChange = () => setSettings(loadSettings());
    window.addEventListener("attendance.settings.changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("attendance.settings.changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return settings;
}
