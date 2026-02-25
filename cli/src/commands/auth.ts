import { Command } from "commander";
import { getOrCreatePublicKey } from "../crypto.js";
import {
  apiRequest,
  clearConfig,
  createSpinner,
  getServerHost,
  saveConfig,
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
    const serverUrl = opts.server.replace(/\/+$/, "");
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
    saveConfig({ serverUrl, token });

    const publicKey = getOrCreatePublicKey(serverHost);

    const keypairSpinner = createSpinner("Uploading public key");
    keypairSpinner.start();

    await apiRequest("PUT", "/api/auth/public-key", {
      publicKey: publicKey.toString("base64"),
    });

    keypairSpinner.stop("✓ Public key uploaded.");
  });

export const logoutCommand = new Command("logout")
  .description("Log out from the server")
  .action(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    clearConfig();
    console.log("Logged out.");
  });

export const whoamiCommand = new Command("whoami")
  .description("Show current user info")
  .action(async () => {
    const user = await apiRequest<UserInfo>("GET", "/api/auth/me");
    console.log(`Logged in as: ${user.github_login}`);
  });
