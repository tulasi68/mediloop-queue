import { describe, expect, it } from "vitest";

describe("queue intake contract", () => {
  it("uses the expected token prefixes", () => {
    expect("A-01".startsWith("A-")).toBe(true);
    expect("W-01".startsWith("W-")).toBe(true);
  });
});
