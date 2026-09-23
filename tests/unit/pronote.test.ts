import { beforeEach, describe, expect, test } from "bun:test";
import { useStudents } from "../../src/store/useStudents";
import {
  decodeText,
  parseCsv,
  parsePronote,
  PronoteParseError,
} from "../../src/utils/pronote";
import { resetStores } from "../helpers";

// A Pronote export, same columns as the real ones, made-up students.
const EXPORT = await Bun.file(`${import.meta.dir}/../fixtures/pronote.csv`).text();

const errorOf = (text: string) => {
  try {
    parsePronote(text);
  } catch (e) {
    if (e instanceof PronoteParseError) return e.code;
    throw e;
  }
  return null;
};

describe("parsePronote", () => {
  test("reads the name and gender of each student, in file order", () => {
    expect(parsePronote(EXPORT)).toEqual([
      { name: "MARTIN Léa", gender: "female" },
      { name: "DUPONT Hugo", gender: "male" },
      { name: "N'DIAYE - ROUX Sam", gender: "male" },
      { name: "LEROY Camille", gender: "female" },
    ]);
  });

  test("handles CRLF, a trailing line break and blank names", () => {
    const text = 'Élèves;Sexe\r\n"A";"Féminin"\r\n"";"Masculin"\r\n"B";""\r\n';
    expect(parsePronote(text)).toEqual([
      { name: "A", gender: "female" },
      { name: "B", gender: "other" },
    ]);
  });

  test("accepts separate Nom / Prénom columns, other separators and short genders", () => {
    expect(parsePronote("Nom,Prénom,Sexe\nMARTIN,Léa,F\nDUPONT,Hugo,M\n")).toEqual([
      { name: "MARTIN Léa", gender: "female" },
      { name: "DUPONT Hugo", gender: "male" },
    ]);
    expect(parsePronote("Sexe\tELEVES\nGarçon\tHUGO\n")).toEqual([
      { name: "HUGO", gender: "male" },
    ]);
  });

  test("refuses a file without a name column, or without students", () => {
    expect(errorOf("Name;Gender\nAlice;F")).toBe("notPronote");
    expect(errorOf("")).toBe("notPronote");
    expect(errorOf("Élèves;Sexe\n")).toBe("empty");
  });
});

test("parseCsv keeps separators, quotes and line breaks inside quotes", () => {
  expect(parseCsv('a;"b;c";"say ""hi""";"two\nlines"\nd', ";")).toEqual([
    ["a", "b;c", 'say "hi"', "two\nlines"],
    ["d"],
  ]);
});

test("decodeText reads UTF-8 (with or without BOM) and Windows-1252", () => {
  const utf8 = new TextEncoder().encode("﻿Élèves");
  expect(decodeText(utf8.buffer)).toBe("Élèves");
  // "Élèves" in Windows-1252, as older Pronote exports are.
  const latin = new Uint8Array([0xc9, 0x6c, 0xe8, 0x76, 0x65, 0x73]);
  expect(decodeText(latin.buffer)).toBe("Élèves");
});

describe("importing into the store", () => {
  beforeEach(resetStores);

  test("imported genders are kept, invalid ones fall back to other", () => {
    const store = useStudents.getState;
    store().importStudents([
      ...parsePronote(EXPORT).slice(0, 2),
      { name: "Robot", gender: "robot" as "other" },
    ]);
    const cls = store().classes[store().currentClassId]!;
    const imported = cls.studentIds.map((id) => store().students[id]!);
    expect(imported.map((s) => [s.name, s.gender])).toEqual([
      ["MARTIN Léa", "female"],
      ["DUPONT Hugo", "male"],
      ["Robot", "other"],
    ]);
  });
});
