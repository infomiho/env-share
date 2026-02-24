import type { Context, Next } from "hono";
import crypto from "node:crypto";
import { sql } from "./db.js";

export type User = {
  id: number;
  github_id: number;
  github_login: string;
  github_name: string | null;
  public_key: string | null;
};

export type AppEnv = {
  Variables: {
    user: User;
    tokenHash: string;
  };
};

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = header.slice(7);
  const tokenHash = hashToken(token);

  const [session] = await sql`
    SELECT u.id, u.github_id, u.github_login, u.github_name, u.public_key
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > now()
  `;

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", {
    id: session.id,
    github_id: session.github_id,
    github_login: session.github_login,
    github_name: session.github_name,
    public_key: session.public_key,
  });
  c.set("tokenHash", tokenHash);

  await next();
}

export async function requireMember(c: Context<AppEnv>): Promise<boolean> {
  const projectId = c.req.param("id");
  const user = c.get("user");

  const [membership] = await sql`
    SELECT 1 FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${user.id}
  `;

  if (!membership) {
    c.res = c.json({ error: "Not a member" }, 403);
    return false;
  }
  return true;
}

export async function requireOwner(c: Context<AppEnv>): Promise<boolean> {
  const projectId = c.req.param("id");
  const user = c.get("user");

  const [project] = await sql`
    SELECT 1 FROM projects
    WHERE id = ${projectId} AND created_by = ${user.id}
  `;

  if (!project) {
    c.res = c.json({ error: "Not the owner" }, 403);
    return false;
  }
  return true;
}
