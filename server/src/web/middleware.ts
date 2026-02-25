import type { Context, Next } from "hono";
import { getSignedCookie } from "hono/cookie";
import { type AppEnv, findSessionUser, hashToken } from "../middleware.js";

if (!process.env.COOKIE_SECRET) {
  throw new Error("COOKIE_SECRET environment variable is required");
}
const COOKIE_SECRET = process.env.COOKIE_SECRET;

export { COOKIE_SECRET };

export async function webAuthMiddleware(c: Context<AppEnv>, next: Next) {
  const token = await getSignedCookie(c, COOKIE_SECRET, "session");
  if (!token) {
    return c.redirect("/web/login");
  }

  const tokenHash = hashToken(token);
  const user = await findSessionUser(tokenHash);

  if (!user) {
    return c.redirect("/web/login");
  }

  c.set("user", user);
  c.set("tokenHash", tokenHash);
  await next();
}
