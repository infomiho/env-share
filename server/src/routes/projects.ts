import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import crypto from "node:crypto";
import { sql } from "../db.js";
import {
  type AppEnv,
  authMiddleware,
  requireMember,
  requireOwner,
} from "../middleware.js";
import { CreateProjectSchema, AddMemberSchema } from "../schemas.js";

async function findUserByLogin(username: string) {
  const [user] = await sql`SELECT id, public_key FROM users WHERE github_login = ${username}`;
  return user ?? null;
}

const projects = new Hono<AppEnv>();

projects.use("/api/projects/*", authMiddleware);

projects.post("/api/projects", vValidator("json", CreateProjectSchema), async (c) => {
  const { name, encryptedProjectKey } = c.req.valid("json");
  const user = c.get("user");
  const id = "p_" + crypto.randomBytes(16).toString("hex");

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO projects (id, name, created_by)
      VALUES (${id}, ${name}, ${user.id})
    `;
    await tx`
      INSERT INTO project_members (project_id, user_id, encrypted_project_key)
      VALUES (${id}, ${user.id}, ${encryptedProjectKey})
    `;
  });

  return c.json({ id, name });
});

projects.get("/api/projects/:id", async (c) => {
  if (!(await requireMember(c))) return c.res;

  const projectId = c.req.param("id");
  const [project] = await sql`SELECT * FROM projects WHERE id = ${projectId}`;

  if (!project) return c.json({ error: "Not found" }, 404);
  return c.json(project);
});

projects.get("/api/projects/:id/key", async (c) => {
  if (!(await requireMember(c))) return c.res;

  const projectId = c.req.param("id");
  const user = c.get("user");

  const [member] = await sql`
    SELECT encrypted_project_key FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${user.id}
  `;

  return c.json({ encryptedProjectKey: member.encrypted_project_key });
});

projects.post("/api/projects/:id/members", vValidator("json", AddMemberSchema), async (c) => {
  if (!(await requireOwner(c))) return c.res;

  const projectId = c.req.param("id");
  const { username, encryptedProjectKey } = c.req.valid("json");

  const targetUser = await findUserByLogin(username);
  if (!targetUser) return c.json({ error: "User not found" }, 404);

  await sql`
    INSERT INTO project_members (project_id, user_id, encrypted_project_key)
    VALUES (${projectId}, ${targetUser.id}, ${encryptedProjectKey})
    ON CONFLICT (project_id, user_id) DO UPDATE SET
      encrypted_project_key = EXCLUDED.encrypted_project_key
  `;

  return c.json({ ok: true });
});

projects.delete("/api/projects/:id/members/:username", async (c) => {
  if (!(await requireOwner(c))) return c.res;

  const projectId = c.req.param("id");
  const username = c.req.param("username");

  const targetUser = await findUserByLogin(username);
  if (!targetUser) return c.json({ error: "User not found" }, 404);

  await sql`
    DELETE FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${targetUser.id}
  `;

  return c.json({ ok: true });
});

projects.get("/api/projects/:id/members", async (c) => {
  if (!(await requireMember(c))) return c.res;

  const projectId = c.req.param("id");

  const members = await sql`
    SELECT u.github_login, u.github_name
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ${projectId}
  `;

  return c.json(members);
});

projects.get("/api/projects/:id/members/:username/public-key", async (c) => {
  if (!(await requireMember(c))) return c.res;

  const username = c.req.param("username");

  const user = await findUserByLogin(username);
  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json({ publicKey: user.public_key });
});

export { projects };
