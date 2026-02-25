import { describe, it, expect, vi } from "vitest";

vi.mock("./db.js", () => ({ sql: vi.fn() }));

import { createGitHubClient } from "./github.js";

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status,
  });
}

describe("createGitHubClient", () => {
  const config = { clientId: "test-id", clientSecret: "test-secret" };

  describe("exchangeDeviceCode", () => {
    it("sends correct body to GitHub", async () => {
      const fetch = mockFetch({ access_token: "gho_abc" });
      const client = createGitHubClient(config, fetch as any);

      await client.exchangeDeviceCode("device-123");

      expect(fetch).toHaveBeenCalledWith(
        "https://github.com/login/oauth/access_token",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"device_code":"device-123"'),
        }),
      );
    });

    it("returns access_token on success", async () => {
      const fetch = mockFetch({ access_token: "gho_abc" });
      const client = createGitHubClient(config, fetch as any);

      const result = await client.exchangeDeviceCode("device-123");
      expect(result.access_token).toBe("gho_abc");
    });

    it("returns error on authorization_pending", async () => {
      const fetch = mockFetch({ error: "authorization_pending" });
      const client = createGitHubClient(config, fetch as any);

      const result = await client.exchangeDeviceCode("device-123");
      expect(result.error).toBe("authorization_pending");
    });
  });

  describe("exchangeOAuthCode", () => {
    it("includes client_secret in body", async () => {
      const fetch = mockFetch({ access_token: "gho_abc" });
      const client = createGitHubClient(config, fetch as any);

      await client.exchangeOAuthCode("code-456");

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"client_secret":"test-secret"'),
        }),
      );
    });
  });

  describe("fetchUser", () => {
    it("sends Bearer token", async () => {
      const fetch = mockFetch({ id: 1, login: "octocat", name: "Octocat" });
      const client = createGitHubClient(config, fetch as any);

      await client.fetchUser("token-789");

      expect(fetch).toHaveBeenCalledWith(
        "https://api.github.com/user",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer token-789",
          }),
        }),
      );
    });
  });
});
