import { describe, it, expect } from "vitest";
import { getServerHost } from "./lib.js";

describe("getServerHost", () => {
  it("extracts host from URL", () => {
    expect(getServerHost("https://example.com")).toBe("example.com");
  });

  it("includes port in output", () => {
    expect(getServerHost("https://example.com:8080")).toContain("8080");
  });

  it("sanitizes special characters to filesystem-safe string", () => {
    expect(getServerHost("https://example.com:8080")).toMatch(
      /^[a-zA-Z0-9._-]+$/,
    );
  });
});
