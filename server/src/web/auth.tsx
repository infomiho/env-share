import { Hono } from "hono";
import { setSignedCookie, deleteCookie } from "hono/cookie";
import { sql } from "../db.js";
import type { AppEnv } from "../middleware.js";
import {
  SESSION_TTL_MS,
  exchangeOAuthCode,
  fetchGitHubUser,
  upsertUser,
  createSession,
} from "../github.js";
import { Layout } from "./layout.js";
import { COOKIE_SECRET, webAuthMiddleware } from "./middleware.js";

const webAuth = new Hono<AppEnv>();

webAuth.get("/login", (c) => {
  return c.html(
    <Layout>
      <div class="flex justify-center items-center min-h-[80vh]">
        <div class="card p-8 text-center max-w-[400px]">
          <h2 class="mb-2">env-share</h2>
          <p class="mb-6 text-muted-foreground">
            Sign in to manage your projects
          </p>
          <a
            class="btn btn-primary inline-flex items-center gap-2"
            href={`https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=read:user`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            Sign in with GitHub
          </a>
        </div>
      </div>
    </Layout>
  );
});

webAuth.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.redirect("/web/login");
  }

  const tokenData = await exchangeOAuthCode(code);
  if (tokenData.error || !tokenData.access_token) {
    return c.redirect("/web/login");
  }

  const ghUser = await fetchGitHubUser(tokenData.access_token);
  const user = await upsertUser(ghUser);
  const token = await createSession(user.id);

  await setSignedCookie(c, "session", token, COOKIE_SECRET, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: SESSION_TTL_MS / 1000,
  });

  return c.redirect("/web");
});

webAuth.post("/logout", webAuthMiddleware, async (c) => {
  await sql`DELETE FROM sessions WHERE token_hash = ${c.get("tokenHash")}`;
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/web/login");
});

export { webAuth };
