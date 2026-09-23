import { expect, test } from "bun:test";
import { byName, sameName } from "../../src/utils/names";

test("byName ignores case and accents, and reads numbers as numbers", () => {
  const names = ["Zoé", "room 10", "élodie", "Room 2", "adam", "", "Eric"];
  expect(names.map((name) => ({ name })).sort(byName).map((x) => x.name)).toEqual([
    "",
    "adam",
    "élodie",
    "Eric",
    "Room 2",
    "room 10",
    "Zoé",
  ]);
});

test("sameName ignores case, accents and surrounding spaces", () => {
  expect(sameName("MARTIN Léa", " martin lea ")).toBe(true);
  expect(sameName("MARTIN Léa", "MARTIN Léo")).toBe(false);
});
