import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eciesDecrypt, eciesEncrypt, loadPrivateKey } from "./crypto.js";

const CONFIG_DIR = path.join(os.homedir(), ".env-share");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const PROJECT_CONFIG_NAME = ".env-share.json";

export interface Config {
  serverUrl: string;
  token: string;
}

export interface ProjectConfig {
  projectId: string;
}

export interface UserInfo {
  github_login: string;
  public_key: string | null;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error("Not logged in. Run 'env-share login' first.");
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

export function saveConfig(config: Config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH);
  }
}

export function loadProjectConfig(): ProjectConfig {
  const configPath = path.join(process.cwd(), PROJECT_CONFIG_NAME);
  if (!fs.existsSync(configPath)) {
    throw new Error("No project config found. Run 'env-share init' first.");
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
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
  body?: unknown,
): Promise<T> {
  const config = loadConfig();
  const url = `${config.serverUrl}${urlPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
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
): Promise<number> {
  const pending = await apiRequest<PendingMember[]>(
    "GET",
    `/api/projects/${projectId}/pending-members`,
  );
  if (pending.length === 0) return 0;

  const members = pending.map((m) => ({
    username: m.github_login,
    encryptedProjectKey: eciesEncrypt(projectKey, Buffer.from(m.public_key, "base64")),
  }));

  const { resolved } = await apiRequest<{ resolved: number }>(
    "POST",
    `/api/projects/${projectId}/resolve-pending`,
    { members },
  );
  return resolved;
}

export async function unwrapProjectKey(projectId: string): Promise<Buffer> {
  const config = loadConfig();
  const serverHost = getServerHost(config.serverUrl);

  const { encryptedProjectKey } = await apiRequest<{ encryptedProjectKey: string }>(
    "GET",
    `/api/projects/${projectId}/key`,
  );

  const privateKey = loadPrivateKey(serverHost);
  return eciesDecrypt(encryptedProjectKey, privateKey);
}
