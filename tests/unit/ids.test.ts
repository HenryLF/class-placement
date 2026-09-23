import { expect, test } from "bun:test";
import { shortId } from "../../src/utils/ids";

test("shortId keeps the first 8 characters", () => {
  expect(shortId("3f9a1c2e-0000-4000-8000-000000000000")).toBe("3f9a1c2e");
});
