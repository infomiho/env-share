import crypto from "node:crypto";
import { sql } from "./db.js";
import { hashToken, type User } from "./middleware.js";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
}

export interface GitHubConfig {
  clientId: string;
  clientSecret: string;
}

export interface GitHubClient {
  exchangeDeviceCode(deviceCode: string): Promise<GitHubTokenResponse>;
  exchangeOAuthCode(code: string): Promise<GitHubTokenResponse>;
  fetchUser(accessToken: string): Promise<GitHubUser>;
}

export function createGitHubClient(
  config: GitHubConfig,
  fetchFn: typeof fetch = fetch,
): GitHubClient {
  async function requestToken(
    body: Record<string, string>,
  ): Promise<GitHubTokenResponse> {
    const response = await fetchFn(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ client_id: config.clientId, ...body }),
      },
    );
    return response.json() as Promise<GitHubTokenResponse>;
  }

  return {
    exchangeDeviceCode(deviceCode: string) {
      return requestToken({
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      });
    },
    exchangeOAuthCode(code: string) {
      return requestToken({ client_secret: config.clientSecret, code });
    },
    async fetchUser(accessToken: string): Promise<GitHubUser> {
      const response = await fetchFn("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      return response.json() as Promise<GitHubUser>;
    },
  };
}

export const github = createGitHubClient({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
});

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
