import { expect, test } from "bun:test";
import { removeProfile } from "../../src/store/profiles";

const p = (id: string) => ({ id });
const three = { a: p("a"), b: p("b"), c: p("c") };
const fresh = () => p("fresh");

test("removes the profile and keeps another loaded one", () => {
  const r = removeProfile(three, "b", "c", fresh);
  expect(Object.keys(r.profiles)).toEqual(["a", "c"]);
  expect(r.currentId).toBe("c");
});

test("removing the loaded profile loads the first remaining one", () => {
  const r = removeProfile(three, "a", "a", fresh);
  expect(Object.keys(r.profiles)).toEqual(["b", "c"]);
  expect(r.currentId).toBe("b");
});

test("removing the last profile creates and loads a fresh one", () => {
  const r = removeProfile({ a: p("a") }, "a", "a", fresh);
  expect(r.profiles).toEqual({ fresh: p("fresh") });
  expect(r.currentId).toBe("fresh");
});

test("doesn't modify the input", () => {
  removeProfile(three, "a", "a", fresh);
  expect(Object.keys(three)).toEqual(["a", "b", "c"]);
});
