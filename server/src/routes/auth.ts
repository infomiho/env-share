import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { sql } from "../db.js";
import { type AppEnv, authMiddleware } from "../middleware.js";
import {
  exchangeDeviceCode,
  fetchGitHubUser,
  upsertUser,
  createSession,
} from "../github.js";
import { DevicePollSchema, PublicKeySchema } from "../schemas.js";

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

  const data = await response.json();

  return c.json({
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    interval: data.interval,
  });
});

auth.post("/api/auth/device/poll", vValidator("json", DevicePollSchema), async (c) => {
  const { device_code } = c.req.valid("json");

  const tokenData = await exchangeDeviceCode(device_code);

  if (tokenData.error || !tokenData.access_token) {
    return c.json({ error: tokenData.error }, 400);
  }

  const ghUser = await fetchGitHubUser(tokenData.access_token);
  const user = await upsertUser(ghUser);
  const token = await createSession(user.id);

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
