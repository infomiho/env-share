import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("../db.js", () => ({ sql: vi.fn() }));

vi.mock("../repositories.js", () => ({
  findProject: vi.fn(),
  createProjectWithMember: vi.fn(),
  findMemberKey: vi.fn(),
  findUserByLogin: vi.fn(),
  upsertMember: vi.fn(),
  removeMember: vi.fn(),
  listMembers: vi.fn(),
  listPendingMembers: vi.fn(),
  resolvePendingMembers: vi.fn(),
  isMember: vi.fn(),
  isOwner: vi.fn(),
}));

vi.mock("../github.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../github.js")>();
  return { ...original, fetchGitHubUserByLogin: vi.fn(), upsertUser: vi.fn() };
});

vi.mock("../middleware.js", async (importOriginal) => {
  const { createMockMiddleware } = await import("../test-utils.js");
  const original = await importOriginal<typeof import("../middleware.js")>();
  return { ...original, ...createMockMiddleware() };
});

import * as repo from "../repositories.js";
import * as gh from "../github.js";
import { projects } from "./projects.js";

function createApp() {
  const app = new Hono();
  app.route("/", projects);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/projects/:id", () => {
  it("returns 404 when project not found", async () => {
    vi.mocked(repo.findProject).mockResolvedValue(null);
    const app = createApp();

    const res = await app.request("/api/projects/p_nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns project on success", async () => {
    vi.mocked(repo.findProject).mockResolvedValue({ id: "p_1", name: "test" });
    const app = createApp();

    const res = await app.request("/api/projects/p_1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "test" });
  });
});

describe("GET /api/projects/:id/key", () => {
  it("returns encrypted project key", async () => {
    vi.mocked(repo.findMemberKey).mockResolvedValue("encrypted-key-data");
    const app = createApp();

    const res = await app.request("/api/projects/p_1/key");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      encryptedProjectKey: "encrypted-key-data",
    });
  });
});

describe("POST /api/projects", () => {
  it("creates a project", async () => {
    vi.mocked(repo.createProjectWithMember).mockResolvedValue(undefined);
    const app = createApp();

    const res = await app.request("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: "test", encryptedProjectKey: "key123" }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("test");
    expect(body.id).toMatch(/^p_/);
    expect(repo.createProjectWithMember).toHaveBeenCalledOnce();
  });
});

describe("POST /api/projects/:id/members", () => {
  it("returns 404 when user not found on GitHub", async () => {
    vi.mocked(repo.findUserByLogin).mockResolvedValue(null);
    vi.mocked(gh.fetchGitHubUserByLogin).mockResolvedValue(null);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/members", {
      method: "POST",
      body: JSON.stringify({ username: "ghost", encryptedProjectKey: "key" }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(404);
  });

  it("adds member on success", async () => {
    vi.mocked(repo.findUserByLogin).mockResolvedValue({
      id: 2,
      public_key: "pk",
    });
    vi.mocked(repo.upsertMember).mockResolvedValue(undefined);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/members", {
      method: "POST",
      body: JSON.stringify({
        username: "octocat",
        encryptedProjectKey: "key",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(200);
    expect(repo.upsertMember).toHaveBeenCalledWith("p_1", 2, "key");
  });

  it("adds pending member when user has no public key", async () => {
    vi.mocked(repo.findUserByLogin).mockResolvedValue(null);
    vi.mocked(gh.fetchGitHubUserByLogin).mockResolvedValue({
      id: 999,
      login: "newuser",
      name: "New User",
    });
    vi.mocked(gh.upsertUser).mockResolvedValue({
      id: 5,
      github_id: 999,
      github_login: "newuser",
      github_name: "New User",
      public_key: null,
    });
    vi.mocked(repo.upsertMember).mockResolvedValue(undefined);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/members", {
      method: "POST",
      body: JSON.stringify({ username: "newuser" }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pending).toBe(true);
    expect(repo.upsertMember).toHaveBeenCalledWith("p_1", 5, null);
  });
});

describe("DELETE /api/projects/:id/members/:username", () => {
  it("returns 404 when user not found", async () => {
    vi.mocked(repo.findUserByLogin).mockResolvedValue(null);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/members/ghost", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  it("removes member on success", async () => {
    vi.mocked(repo.findUserByLogin).mockResolvedValue({
      id: 2,
      public_key: "pk",
    });
    vi.mocked(repo.removeMember).mockResolvedValue(undefined);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/members/octocat", {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    expect(repo.removeMember).toHaveBeenCalledWith("p_1", 2);
  });
});

describe("GET /api/projects/:id/members", () => {
  it("returns members list", async () => {
    const members = [
      { github_login: "user1", github_name: "User One" },
      { github_login: "user2", github_name: "User Two" },
    ];
    vi.mocked(repo.listMembers).mockResolvedValue(members as any);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/members");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(members);
  });
});

describe("GET /api/projects/:id/pending-members", () => {
  it("returns pending members", async () => {
    const pending = [
      { user_id: 5, github_login: "newuser", public_key: "pk123" },
    ];
    vi.mocked(repo.listPendingMembers).mockResolvedValue(pending as any);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/pending-members");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(pending);
  });
});

describe("POST /api/projects/:id/resolve-pending", () => {
  it("resolves pending members", async () => {
    vi.mocked(repo.findUserByLogin).mockResolvedValue({ id: 5, public_key: "pk" });
    vi.mocked(repo.resolvePendingMembers).mockResolvedValue(undefined);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/resolve-pending", {
      method: "POST",
      body: JSON.stringify({
        members: [{ username: "newuser", encryptedProjectKey: "wrapped-key" }],
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(200);
    expect(repo.resolvePendingMembers).toHaveBeenCalledWith("p_1", [
      { userId: 5, encryptedProjectKey: "wrapped-key" },
    ]);
  });
});

describe("GET /api/projects/:id/members/:username/public-key", () => {
  it("returns 404 when user not found", async () => {
    vi.mocked(repo.findUserByLogin).mockResolvedValue(null);
    const app = createApp();

    const res = await app.request(
      "/api/projects/p_1/members/ghost/public-key",
    );
    expect(res.status).toBe(404);
  });

  it("returns public key", async () => {
    vi.mocked(repo.findUserByLogin).mockResolvedValue({
      id: 2,
      public_key: "pubkey123",
    });
    const app = createApp();

    const res = await app.request(
      "/api/projects/p_1/members/octocat/public-key",
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ publicKey: "pubkey123" });
  });
});
