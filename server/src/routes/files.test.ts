import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db.js", () => ({ sql: vi.fn() }));

vi.mock("../repositories.js", () => ({
  insertFile: vi.fn(),
  getLatestFile: vi.fn(),
  getFileHistory: vi.fn(),
  deleteFile: vi.fn(),
  listFiles: vi.fn(),
  isMember: vi.fn(),
  isOwner: vi.fn(),
}));

vi.mock("../middleware.js", async (importOriginal) => {
  const { createMockMiddleware } = await import("../test-utils.js");
  const original = await importOriginal<typeof import("../middleware.js")>();
  return { ...original, ...createMockMiddleware() };
});

import * as repo from "../repositories.js";
import { files } from "./files.js";

function createApp() {
  const app = new Hono();
  app.route("/", files);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PUT /api/projects/:id/files/:name", () => {
  it("uploads a file", async () => {
    vi.mocked(repo.insertFile).mockResolvedValue(undefined);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/files/.env", {
      method: "PUT",
      body: JSON.stringify({ encryptedContent: "encrypted-data" }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    expect(res.status).toBe(200);
    expect(repo.insertFile).toHaveBeenCalledWith("p_1", ".env", "encrypted-data");
  });
});

describe("GET /api/projects/:id/files/:name", () => {
  it("returns 404 when file not found", async () => {
    vi.mocked(repo.getLatestFile).mockResolvedValue(null);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/files/.env");
    expect(res.status).toBe(404);
  });

  it("returns file content on success", async () => {
    vi.mocked(repo.getLatestFile).mockResolvedValue({
      encrypted_content: "encrypted-data",
    });
    const app = createApp();

    const res = await app.request("/api/projects/p_1/files/.env");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ encryptedContent: "encrypted-data" });
  });
});

describe("GET /api/projects/:id/files/:name/history", () => {
  it("returns file history", async () => {
    const history = [
      { id: 2, created_at: "2024-01-02" },
      { id: 1, created_at: "2024-01-01" },
    ];
    vi.mocked(repo.getFileHistory).mockResolvedValue(history as any);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/files/.env/history");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(history);
  });
});

describe("DELETE /api/projects/:id/files/:name", () => {
  it("returns 404 when file not found", async () => {
    vi.mocked(repo.deleteFile).mockResolvedValue(false);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/files/.env", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  it("deletes file on success", async () => {
    vi.mocked(repo.deleteFile).mockResolvedValue(true);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/files/.env", {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("GET /api/projects/:id/files", () => {
  it("returns file list", async () => {
    const fileList = [
      { name: ".env", created_at: "2024-01-01" },
      { name: ".env.local", created_at: "2024-01-02" },
    ];
    vi.mocked(repo.listFiles).mockResolvedValue(fileList as any);
    const app = createApp();

    const res = await app.request("/api/projects/p_1/files");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fileList);
  });
});
