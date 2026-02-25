import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerHost, loadToken, removeToken, saveToken } from "./lib.js";

describe("getServerHost", () => {
  it("extracts host from URL", () => {
    expect(getServerHost("https://example.com")).toBe("example.com");
  });

  it("includes port in output", () => {
    expect(getServerHost("https://example.com:8080")).toContain("8080");
  });

  it("sanitizes special characters to filesystem-safe string", () => {
    expect(getServerHost("https://example.com:8080")).toMatch(/^[a-zA-Z0-9._-]+$/);
  });
});

describe("token management", () => {
  let tmpDir: string;
  const configPath = () => path.join(tmpDir, ".env-share", "config.json");

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-share-test-"));
    vi.stubEnv("HOME", tmpDir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saveToken creates config and stores token by host", () => {
    saveToken("https://env.miho.dev", "tok_abc");

    const config = JSON.parse(fs.readFileSync(configPath(), "utf-8"));
    expect(config.servers["env.miho.dev"]).toEqual({ token: "tok_abc" });
  });

  it("loadToken retrieves a saved token", () => {
    saveToken("https://env.miho.dev", "tok_abc");

    expect(loadToken("https://env.miho.dev")).toBe("tok_abc");
  });

  it("loadToken throws for unknown server", () => {
    expect(() => loadToken("https://unknown.dev")).toThrow("Not logged in");
  });

  it("saves tokens for multiple servers independently", () => {
    saveToken("https://env.miho.dev", "tok_prod");
    saveToken("http://localhost:3000", "tok_local");

    expect(loadToken("https://env.miho.dev")).toBe("tok_prod");
    expect(loadToken("http://localhost:3000")).toBe("tok_local");
  });

  it("removeToken deletes a specific server entry", () => {
    saveToken("https://env.miho.dev", "tok_prod");
    saveToken("http://localhost:3000", "tok_local");

    removeToken("https://env.miho.dev");

    expect(() => loadToken("https://env.miho.dev")).toThrow("Not logged in");
    expect(loadToken("http://localhost:3000")).toBe("tok_local");
  });

  it("config file has restrictive permissions", () => {
    saveToken("https://env.miho.dev", "tok_abc");

    const stats = fs.statSync(configPath());
    const mode = (stats.mode & 0o777).toString(8);
    expect(mode).toBe("600");
  });
});
