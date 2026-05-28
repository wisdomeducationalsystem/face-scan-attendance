import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

function getKeys() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  if (!GOOGLE_SHEETS_API_KEY) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");
  return { LOVABLE_API_KEY, GOOGLE_SHEETS_API_KEY };
}

async function gw(path: string, init: RequestInit = {}) {
  const { LOVABLE_API_KEY, GOOGLE_SHEETS_API_KEY } = getKeys();
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Google Sheets API [${res.status}]: ${text.slice(0, 300)}`);
  }
  return data;
}

function extractSpreadsheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

export const getSpreadsheetMeta = createServerFn({ method: "POST" })
  .inputValidator(z.object({ spreadsheetId: z.string().min(1) }).parse)
  .handler(async ({ data }) => {
    const id = extractSpreadsheetId(data.spreadsheetId);
    const meta = await gw(`/spreadsheets/${id}?fields=spreadsheetId,properties.title,sheets.properties`);
    return {
      id: meta.spreadsheetId as string,
      title: meta.properties?.title as string,
      sheets: (meta.sheets ?? []).map((s: { properties: { title: string; sheetId: number } }) => ({
        title: s.properties.title,
        sheetId: s.properties.sheetId,
      })),
    };
  });

export const getStudents = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      spreadsheetId: z.string().min(1),
      sheetName: z.string().min(1).default("Students"),
    }).parse,
  )
  .handler(async ({ data }) => {
    const id = extractSpreadsheetId(data.spreadsheetId);
    const range = `${data.sheetName}!A1:Z2000`;
    const result = await gw(`/spreadsheets/${id}/values/${range}`);
    const values: string[][] = result.values ?? [];
    if (values.length === 0) return { headers: [], students: [] };
    const headers = values[0].map((h) => h.trim());
    const idIdx = headers.findIndex((h) => /^(studentid|id|student\s*id)$/i.test(h));
    const nameIdx = headers.findIndex((h) => /^(name|fullname|student\s*name)$/i.test(h));
    const activeIdx = headers.findIndex((h) => /^active$/i.test(h));
    if (idIdx === -1 || nameIdx === -1) {
      throw new Error(
        `Couldn't find StudentID and Name columns in "${data.sheetName}". Found headers: ${headers.join(", ")}`,
      );
    }
    const isActiveValue = (val: string) => {
      const v = String(val).trim().toLowerCase();
      return v === "active" || v === "yes" || v === "true" || v === "1" || v === "y";
    };
    const students = values.slice(1)
      .filter((row) => row[idIdx]?.trim())
      .filter((row) => activeIdx === -1 || isActiveValue(row[activeIdx] ?? ""))
      .map((row) => ({
        studentId: String(row[idIdx] ?? "").trim(),
        name: String(row[nameIdx] ?? "").trim(),
        active: activeIdx === -1 ? true : isActiveValue(row[activeIdx] ?? ""),
      }));
    return { headers, students };
  });

async function ensureAttendanceSheet(spreadsheetId: string, sheetName: string) {
  const meta = await gw(
    `/spreadsheets/${spreadsheetId}?fields=sheets.properties(title,sheetId)`,
  );
  const exists = (meta.sheets ?? []).some(
    (s: { properties: { title: string } }) => s.properties.title === sheetName,
  );
  if (!exists) {
    await gw(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    });
    // header row
    await gw(
      `/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:J1?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({
          values: [[
            "Scan ID", "ID", "Name", "Institute", "Date",
            "In Time", "Out Time", "Duration", "Employee/Student", "Status",
          ]],
        }),
      },
    );
  }
}

function randomScanId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function formatTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const appendAttendance = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      spreadsheetId: z.string().min(1),
      attendanceSheet: z.string().min(1).default("Attendance"),
      studentId: z.string().min(1),
      name: z.string().min(1),
      status: z.string().min(1).default("Present"),
      institute: z.string().min(1).default("INS003"),
      role: z.string().min(1).default("Student"),
    }).parse,
  )
  .handler(async ({ data }) => {
    const id = extractSpreadsheetId(data.spreadsheetId);
    await ensureAttendanceSheet(id, data.attendanceSheet);
    const now = new Date();
    const scanId = randomScanId();
    const date = formatDate(now);
    const inTime = formatTime(now);
    const range = `${data.attendanceSheet}!A:J`;
    await gw(
      `/spreadsheets/${id}/values/${range}:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        body: JSON.stringify({
          values: [[
            scanId, data.studentId, data.name, data.institute, date,
            inTime, "", "", data.role, data.status,
          ]],
        }),
      },
    );
    return { ok: true, scanId, date, inTime };
  });

export const getTodayAttendance = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      spreadsheetId: z.string().min(1),
      attendanceSheet: z.string().min(1).default("Attendance"),
    }).parse,
  )
  .handler(async ({ data }) => {
    const id = extractSpreadsheetId(data.spreadsheetId);
    try {
      const result = await gw(
        `/spreadsheets/${id}/values/${data.attendanceSheet}!A1:J5000`,
      );
      const values: string[][] = result.values ?? [];
      if (values.length <= 1) return { entries: [] };
      const today = formatDate(new Date());
      const entries = values
        .slice(1)
        .map((row, i) => ({
          rowIndex: i + 2,
          timestamp: row[5] ?? "",
          date: row[4] ?? "",
          studentId: row[1] ?? "",
          name: row[2] ?? "",
          status: row[9] ?? "",
        }))
        .filter((e) => e.date === today);
      return { entries };
    } catch {
      return { entries: [] };
    }
  });

