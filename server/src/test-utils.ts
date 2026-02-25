import { vi } from "vitest";

export const TEST_USER = {
  id: 1,
  github_id: 123,
  github_login: "testuser",
  github_name: "Test",
  public_key: null,
};

export function createMockMiddleware() {
  return {
    authMiddleware: vi.fn(async (c: any, next: any) => {
      c.set("user", TEST_USER);
      c.set("tokenHash", "fakehash");
      await next();
    }),
    memberOnly: vi.fn(async (_c: any, next: any) => {
      await next();
    }),
    ownerOnly: vi.fn(async (_c: any, next: any) => {
      await next();
    }),
  };
}
