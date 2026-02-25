import { describe, it, expect } from "vitest";
import { formatDate } from "./format.js";

describe("formatDate", () => {
  it("formats date string", () => {
    expect(formatDate("2024-01-15T12:00:00Z")).toBe("Jan 15, 2024");
  });

  it("formats Date object", () => {
    expect(formatDate(new Date(2024, 0, 15))).toBe("Jan 15, 2024");
  });
});
