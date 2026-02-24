import type { Context, Next } from "hono";
import { getSignedCookie } from "hono/cookie";
import { type AppEnv, hashToken, findSessionUser } from "../middleware.js";

const COOKIE_SECRET = process.env.COOKIE_SECRET || "dev-secret";

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
