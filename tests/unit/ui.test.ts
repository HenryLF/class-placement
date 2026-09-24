import { beforeEach, describe, expect, test } from "bun:test";
import { NAME_SIZE, toNameSize, useUI } from "../../src/store/useUI";
import { resetStores } from "../helpers";

const store = () => useUI.getState();
const cssNameSize = () => document.documentElement.style.getPropertyValue("--name-size");

beforeEach(resetStores);

describe("toNameSize", () => {
  test("keeps a whole number inside the range", () => {
    expect(toNameSize(20)).toBe(20);
    expect(toNameSize("14")).toBe(14);
    expect(toNameSize(13.6)).toBe(14);
  });

  test("clamps what is out of range and falls back on nonsense", () => {
    expect(toNameSize(0)).toBe(NAME_SIZE.min);
    expect(toNameSize(999)).toBe(NAME_SIZE.max);
    expect(toNameSize("")).toBe(NAME_SIZE.min); // Number("") is 0
    expect(toNameSize(undefined)).toBe(NAME_SIZE.default);
    expect(toNameSize("big")).toBe(NAME_SIZE.default);
  });
});

describe("the name size", () => {
  test("setNameSize stores it clamped, and the tables read it from --name-size", () => {
    store().setNameSize(24);
    expect(store().nameSize).toBe(24);
    expect(cssNameSize()).toBe("24px");

    store().setNameSize(1000);
    expect(store().nameSize).toBe(NAME_SIZE.max);
    expect(cssNameSize()).toBe(`${NAME_SIZE.max}px`);
  });

  test("saved data without one, or with a broken one, still loads", async () => {
    localStorage.setItem(
      "class-placement-ui",
      JSON.stringify({ state: { theme: "chalk" } }),
    );
    await useUI.persist.rehydrate();
    expect(store().nameSize).toBe(NAME_SIZE.default);
    expect(store().theme).toBe("chalk");

    localStorage.setItem(
      "class-placement-ui",
      JSON.stringify({ state: { theme: "chalk", nameSize: "huge" } }),
    );
    await useUI.persist.rehydrate();
    expect(store().nameSize).toBe(NAME_SIZE.default);
  });
});
