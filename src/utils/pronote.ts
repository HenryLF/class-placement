// Reads the student list exported by Pronote as CSV: one row per student,
// ";"-separated, with the name in "Élèves" ("NOM Prénom") and the gender in
// "Sexe". Other columns are ignored. Pure, so it can be tested directly.
import type { Gender, NewStudent } from "../store/useStudents";

export type PronoteError = "notPronote" | "empty";

export class PronoteParseError extends Error {
  constructor(readonly code: PronoteError) {
    super(code);
  }
}

/** File bytes as text: UTF-8 when valid, else Windows-1252 (older exports). */
export function decodeText(bytes: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

/** Rows of fields. Quoted fields may hold the separator, "" and line breaks. */
export function parseCsv(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') field += text[++i];
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === separator) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) rows.push([...row, field]);
  return rows;
}

// Lowercase, without accents or surrounding spaces: "Élèves " -> "eleves".
const key = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

function toGender(value: string): Gender {
  const v = key(value);
  if (v.startsWith("f")) return "female"; // Féminin, F, Fille
  if (v.startsWith("m") || v.startsWith("g")) return "male"; // Masculin, M, Garçon
  return "other";
}

/**
 * The students in a Pronote CSV export, in file order. Also accepts
 * separate "Nom" and "Prénom" columns, and "," or tab separators. Throws a
 * PronoteParseError without a name column, or without any student.
 */
export function parsePronote(text: string): NewStudent[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (sep: string) => firstLine.split(sep).length;
  const separator = [";", "\t", ","].reduce((a, b) => (count(b) > count(a) ? b : a));
  const [header = [], ...rows] = parseCsv(text, separator);

  const column = (...names: string[]) => header.findIndex((h) => names.includes(key(h)));
  const full = column("eleves", "eleve");
  const last = column("nom");
  const first = column("prenom");
  const sex = column("sexe", "genre");
  if (full < 0 && last < 0) throw new PronoteParseError("notPronote");

  const students: NewStudent[] = [];
  for (const row of rows) {
    const cell = (i: number) => (i < 0 ? "" : (row[i] ?? "").trim());
    const name = full >= 0 ? cell(full) : `${cell(last)} ${cell(first)}`.trim();
    if (name !== "") students.push({ name, gender: toGender(cell(sex)) });
  }
  if (students.length === 0) throw new PronoteParseError("empty");
  return students;
}
