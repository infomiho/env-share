import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import crypto from "node:crypto";
import { sql } from "../db.js";
import { type AppEnv, authMiddleware, hashToken } from "../middleware.js";
import { DevicePollSchema, PublicKeySchema } from "../schemas.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface GitHubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
}

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
}

const auth = new Hono<AppEnv>();

auth.post("/api/auth/device", async (c) => {
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      scope: "read:user",
    }),
  });

  const data: GitHubDeviceCodeResponse = await response.json();

  return c.json({
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    interval: data.interval,
  });
});

auth.post("/api/auth/device/poll", vValidator("json", DevicePollSchema), async (c) => {
  const { device_code } = c.req.valid("json");

  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    }
  );

  const tokenData: GitHubTokenResponse = await tokenResponse.json();

  if (tokenData.error) {
    return c.json({ error: tokenData.error }, 400);
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token!}`,
      Accept: "application/json",
    },
  });

  const ghUser: GitHubUser = await userResponse.json();

  const [user] = await sql`
    INSERT INTO users (github_id, github_login, github_name)
    VALUES (${ghUser.id}, ${ghUser.login}, ${ghUser.name})
    ON CONFLICT (github_id) DO UPDATE SET
      github_login = EXCLUDED.github_login,
      github_name = EXCLUDED.github_name
    RETURNING *
  `;

  const token = "ess_" + crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${user.id}, ${expiresAt})
  `;

  return c.json({ token, user });
});

auth.get("/api/auth/me", authMiddleware, async (c) => {
  return c.json(c.get("user"));
});

auth.post("/api/auth/logout", authMiddleware, async (c) => {
  await sql`DELETE FROM sessions WHERE token_hash = ${c.get("tokenHash")}`;
  return c.json({ ok: true });
});

auth.put("/api/auth/public-key", authMiddleware, vValidator("json", PublicKeySchema), async (c) => {
  const { publicKey } = c.req.valid("json");
  const user = c.get("user");
  await sql`UPDATE users SET public_key = ${publicKey} WHERE id = ${user.id}`;
  return c.json({ ok: true });
});

export { auth };
