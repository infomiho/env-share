import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eciesDecrypt, eciesEncrypt, loadPrivateKey } from "./crypto.js";

function getConfigDir() {
  return path.join(os.homedir(), ".env-share");
}

function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

const PROJECT_CONFIG_NAME = ".env-share.json";

interface MultiServerConfig {
  servers: Record<string, { token: string }>;
}

export interface ProjectConfig {
  projectId: string;
  serverUrl: string;
}

export class InvalidProjectConfigError extends Error {}

export interface UserInfo {
  github_login: string;
  public_key: string | null;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface ApiRequestOptions {
  body?: unknown;
  serverUrl?: string;
}

function loadGlobalConfig(): MultiServerConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { servers: {} };
  }
  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  if (!raw.servers) {
    return { servers: {} };
  }
  return raw;
}

function saveGlobalConfig(config: MultiServerConfig) {
  fs.mkdirSync(getConfigDir(), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function normalizeServerUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function loadToken(serverUrl: string): string {
  const config = loadGlobalConfig();
  const host = getServerHost(serverUrl);
  const entry = config.servers[host];
  if (!entry) {
    throw new Error(
      `Not logged in to ${serverUrl}. Run 'env-share login --server ${serverUrl}' first.`,
    );
  }
  return entry.token;
}

export function saveToken(serverUrl: string, token: string) {
  const config = loadGlobalConfig();
  const host = getServerHost(serverUrl);
  config.servers[host] = { token };
  saveGlobalConfig(config);
}

export function removeToken(serverUrl: string) {
  const config = loadGlobalConfig();
  const host = getServerHost(serverUrl);
  delete config.servers[host];
  saveGlobalConfig(config);
}

export function loadProjectConfig(): ProjectConfig {
  const configPath = path.join(process.cwd(), PROJECT_CONFIG_NAME);
  if (!fs.existsSync(configPath)) {
    throw new Error("No project config found. Run 'env-share init' first.");
  }
  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  if (!raw.projectId || !raw.serverUrl) {
    throw new InvalidProjectConfigError(
      "Project config is missing serverUrl. Re-run 'env-share init --server <url>' to fix it.",
    );
  }
  return raw;
}

export function saveProjectConfig(config: ProjectConfig) {
  const configPath = path.join(process.cwd(), PROJECT_CONFIG_NAME);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function getServerHost(serverUrl: string): string {
  return new URL(serverUrl).host.replace(/[^a-zA-Z0-9.-]/g, "_");
}

export async function apiRequest<T>(
  method: HttpMethod,
  urlPath: string,
  options?: ApiRequestOptions,
): Promise<T> {
  const { body, serverUrl } = options ?? {};
  const resolvedServerUrl = serverUrl ?? loadProjectConfig().serverUrl;
  const token = loadToken(resolvedServerUrl);
  const url = `${resolvedServerUrl}${urlPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const text = await response.text();
    let message: string;
    try {
      message = JSON.parse(text).error ?? text;
    } catch {
      message = text;
    }
    throw new Error(`API error (${response.status}): ${message}`);
  }

  return response.json() as Promise<T>;
}

export function isCI(): boolean {
  return !process.stdout.isTTY || !!process.env.CI;
}

export function createSpinner(message: string): {
  start: () => void;
  stop: (finalMessage: string) => void;
} {
  const ci = isCI();
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frameIndex = 0;
  let interval: NodeJS.Timeout | null = null;

  return {
    start: () => {
      if (ci) {
        console.log(`${message}...`);
        return;
      }
      process.stdout.write(`${frames[0]} ${message}`);
      interval = setInterval(() => {
        frameIndex = (frameIndex + 1) % frames.length;
        process.stdout.write(`\r${frames[frameIndex]} ${message}`);
      }, 80);
    },
    stop: (finalMessage: string) => {
      if (interval) {
        clearInterval(interval);
        process.stdout.write(`\r\x1b[K${finalMessage}\n`);
      } else if (ci) {
        console.log(finalMessage);
      }
    },
  };
}

interface PendingMember {
  github_login: string;
  public_key: string;
}

export async function resolvePendingMembers(
  projectId: string,
  projectKey: Buffer,
  serverUrl: string,
): Promise<number> {
  const pending = await apiRequest<PendingMember[]>(
    "GET",
    `/api/projects/${projectId}/pending-members`,
    { serverUrl },
  );
  if (pending.length === 0) return 0;

  const members = pending.map((m) => ({
    username: m.github_login,
    encryptedProjectKey: eciesEncrypt(projectKey, Buffer.from(m.public_key, "base64")),
  }));

  const { resolved } = await apiRequest<{ resolved: number }>(
    "POST",
    `/api/projects/${projectId}/resolve-pending`,
    { body: { members }, serverUrl },
  );
  return resolved;
}

export async function unwrapProjectKey(projectId: string, serverUrl: string): Promise<Buffer> {
  const serverHost = getServerHost(serverUrl);

  const { encryptedProjectKey } = await apiRequest<{ encryptedProjectKey: string }>(
    "GET",
    `/api/projects/${projectId}/key`,
    { serverUrl },
  );

  const privateKey = loadPrivateKey(serverHost);
  return eciesDecrypt(encryptedProjectKey, privateKey);
}
