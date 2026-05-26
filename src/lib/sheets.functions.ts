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
    if (idIdx === -1 || nameIdx === -1) {
      throw new Error(
        `Couldn't find StudentID and Name columns in "${data.sheetName}". Found headers: ${headers.join(", ")}`,
      );
    }
    const students = values.slice(1)
      .filter((row) => row[idIdx]?.trim())
      .map((row) => ({
        studentId: String(row[idIdx] ?? "").trim(),
        name: String(row[nameIdx] ?? "").trim(),
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
      `/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:E1?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({
          values: [["Timestamp", "Date", "StudentID", "Name", "Status"]],
        }),
      },
    );
  }
}

export const appendAttendance = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      spreadsheetId: z.string().min(1),
      attendanceSheet: z.string().min(1).default("Attendance"),
      studentId: z.string().min(1),
      name: z.string().min(1),
      status: z.string().min(1).default("Present"),
    }).parse,
  )
  .handler(async ({ data }) => {
    const id = extractSpreadsheetId(data.spreadsheetId);
    await ensureAttendanceSheet(id, data.attendanceSheet);
    const now = new Date();
    const timestamp = now.toISOString();
    const date = now.toISOString().slice(0, 10);
    const range = `${data.attendanceSheet}!A:E`;
    await gw(
      `/spreadsheets/${id}/values/${range}:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        body: JSON.stringify({
          values: [[timestamp, date, data.studentId, data.name, data.status]],
        }),
      },
    );
    return { ok: true, timestamp, date };
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
        `/spreadsheets/${id}/values/${data.attendanceSheet}!A1:E5000`,
      );
      const values: string[][] = result.values ?? [];
      if (values.length <= 1) return { entries: [] };
      const today = new Date().toISOString().slice(0, 10);
      const entries = values
        .slice(1)
        .map((row, i) => ({
          rowIndex: i + 2,
          timestamp: row[0] ?? "",
          date: row[1] ?? "",
          studentId: row[2] ?? "",
          name: row[3] ?? "",
          status: row[4] ?? "",
        }))
        .filter((e) => e.date === today);
      return { entries };
    } catch {
      return { entries: [] };
    }
  });
