import { Command } from "commander";
import { getOrCreatePublicKey } from "../crypto.js";
import {
  apiRequest,
  createSpinner,
  getServerHost,
  InvalidProjectConfigError,
  loadProjectConfig,
  normalizeServerUrl,
  removeToken,
  saveToken,
  type UserInfo,
} from "../lib.js";

interface DeviceFlowResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
}

interface PollResponse {
  token?: string;
}

export const loginCommand = new Command("login")
  .description("Authenticate with a server via GitHub")
  .requiredOption("--server <url>", "Server URL")
  .action(async (opts) => {
    const serverUrl = normalizeServerUrl(opts.server);
    const serverHost = getServerHost(serverUrl);

    const deviceResponse = await fetch(`${serverUrl}/api/auth/device`, {
      method: "POST",
    });

    if (!deviceResponse.ok) {
      throw new Error(`Failed to start device flow: ${deviceResponse.statusText}`);
    }

    const { device_code, user_code, verification_uri, interval } =
      (await deviceResponse.json()) as DeviceFlowResponse;

    const pollIntervalMs = (interval || 5) * 1000;

    console.log(`\nOpen this URL in your browser: ${verification_uri}`);
    console.log(`Enter code: ${user_code}\n`);

    const pollSpinner = createSpinner("Waiting for authorization");
    pollSpinner.start();

    let token: string | null = null;
    while (!token) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const pollResponse = await fetch(`${serverUrl}/api/auth/device/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code }),
      });

      if (pollResponse.ok) {
        const data = (await pollResponse.json()) as PollResponse;
        token = data.token ?? null;
      }
    }

    pollSpinner.stop("✓ Logged in successfully.");
    saveToken(serverUrl, token);

    const publicKey = getOrCreatePublicKey(serverHost);

    const keypairSpinner = createSpinner("Uploading public key");
    keypairSpinner.start();

    await apiRequest("PUT", "/api/auth/public-key", {
      body: { publicKey: publicKey.toString("base64") },
      serverUrl,
    });

    keypairSpinner.stop("✓ Public key uploaded.");
  });

function resolveServerUrl(opts: { server?: string }): string {
  if (opts.server) return normalizeServerUrl(opts.server);
  try {
    return loadProjectConfig().serverUrl;
  } catch (err) {
    if (err instanceof InvalidProjectConfigError) throw err;
    throw new Error("Run this from a project directory or use --server <url>.");
  }
}

export const logoutCommand = new Command("logout")
  .description("Log out from the server")
  .option("--server <url>", "Server URL")
  .action(async (opts) => {
    const serverUrl = resolveServerUrl(opts);
    try {
      await apiRequest("POST", "/api/auth/logout", { serverUrl });
    } catch {}
    removeToken(serverUrl);
    console.log("Logged out.");
  });

export const whoamiCommand = new Command("whoami")
  .description("Show current user info")
  .option("--server <url>", "Server URL")
  .action(async (opts) => {
    const serverUrl = resolveServerUrl(opts);
    const user = await apiRequest<UserInfo>("GET", "/api/auth/me", { serverUrl });
    console.log(`Logged in as: ${user.github_login}`);
  });
