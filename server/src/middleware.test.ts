import { describe, expect, it, vi } from "vitest";

vi.mock("./db.js", () => ({ sql: vi.fn() }));

import { hashToken } from "./middleware.js";

describe("hashToken", () => {
  it("returns consistent hash for same input", () => {
    expect(hashToken("test-token")).toBe(hashToken("test-token"));
  });

  it("returns different hashes for different inputs", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("returns 64-char hex string", () => {
    const hash = hashToken("any-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
