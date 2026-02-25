import crypto from "node:crypto";
import { sql } from "./db.js";
import { hashToken, type User } from "./middleware.js";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
}

export async function exchangeDeviceCode(deviceCode: string): Promise<GitHubTokenResponse> {
  const response = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    }
  );
  return response.json();
}

export async function exchangeOAuthCode(code: string): Promise<GitHubTokenResponse> {
  const response = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    }
  );
  return response.json();
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  return response.json();
}

export async function upsertUser(ghUser: GitHubUser): Promise<User> {
  const [user] = await sql`
    INSERT INTO users (github_id, github_login, github_name)
    VALUES (${ghUser.id}, ${ghUser.login}, ${ghUser.name ?? null})
    ON CONFLICT (github_id) DO UPDATE SET
      github_login = EXCLUDED.github_login,
      github_name = EXCLUDED.github_name
    RETURNING *
  `;
  return {
    id: user.id,
    github_id: user.github_id,
    github_login: user.github_login,
    github_name: user.github_name,
    public_key: user.public_key,
  };
}

export async function createSession(userId: number): Promise<string> {
  const token = "ess_" + crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${userId}, ${expiresAt})
  `;

  return token;
}
