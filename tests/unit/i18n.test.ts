import { expect, test } from "bun:test";
import en from "../../src/i18n/en";
import fr from "../../src/i18n/fr";

// Dotted paths of every leaf, e.g. "students.columns.name".
function paths(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? paths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function leaf(obj: object, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj);
}

test("French has exactly the English keys", () => {
  expect(paths(fr).sort()).toEqual(paths(en).sort());
});

test("every entry is a non-empty string or returns one", () => {
  for (const dict of [en, fr])
    for (const path of paths(dict)) {
      const value = leaf(dict, path);
      const text =
        typeof value === "function" ? (value as (a: never) => unknown)("x" as never) : value;
      expect(typeof text, path).toBe("string");
      expect((text as string).length, path).toBeGreaterThan(0);
    }
});

test("French punctuation is attached with non-breaking spaces", () => {
  for (const path of paths(fr)) {
    const value = leaf(fr, path);
    const text =
      typeof value === "function" ? (value as (a: never, b: never) => string)("x" as never, "y" as never) : String(value);
    expect(text, path).not.toMatch(/ [?:!;»]|« /);
  }
});
