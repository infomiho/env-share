import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { sql } from "../db.js";
import { type AppEnv, authMiddleware, requireMember } from "../middleware.js";
import { UploadFileSchema } from "../schemas.js";

const files = new Hono<AppEnv>();

files.use("/api/projects/:id/files/*", authMiddleware);
files.use("/api/projects/:id/files", authMiddleware);

files.put("/api/projects/:id/files/:name", vValidator("json", UploadFileSchema), async (c) => {
  if (!(await requireMember(c))) return c.res;

  const projectId = c.req.param("id");
  const name = c.req.param("name");
  const { encryptedContent } = c.req.valid("json");

  await sql`
    INSERT INTO files (project_id, name, encrypted_content)
    VALUES (${projectId}, ${name}, ${encryptedContent})
  `;

  return c.json({ ok: true });
});

files.get("/api/projects/:id/files/:name/history", async (c) => {
  if (!(await requireMember(c))) return c.res;

  const projectId = c.req.param("id");
  const name = c.req.param("name");

  const result = await sql`
    SELECT id, created_at FROM files
    WHERE project_id = ${projectId} AND name = ${name}
    ORDER BY id DESC
  `;

  return c.json(result);
});

files.get("/api/projects/:id/files/:name", async (c) => {
  if (!(await requireMember(c))) return c.res;

  const projectId = c.req.param("id");
  const name = c.req.param("name");

  const [file] = await sql`
    SELECT encrypted_content FROM files
    WHERE project_id = ${projectId} AND name = ${name}
    ORDER BY id DESC LIMIT 1
  `;

  if (!file) return c.json({ error: "File not found" }, 404);

  return c.json({ encryptedContent: file.encrypted_content });
});

files.delete("/api/projects/:id/files/:name", async (c) => {
  if (!(await requireMember(c))) return c.res;

  const projectId = c.req.param("id");
  const name = c.req.param("name");

  const [deleted] = await sql`
    DELETE FROM files
    WHERE project_id = ${projectId} AND name = ${name}
    RETURNING id
  `;

  if (!deleted) return c.json({ error: "File not found" }, 404);

  return c.json({ ok: true });
});

files.get("/api/projects/:id/files", async (c) => {
  if (!(await requireMember(c))) return c.res;

  const projectId = c.req.param("id");

  const result = await sql`
    SELECT DISTINCT ON (name) name, created_at
    FROM files
    WHERE project_id = ${projectId}
    ORDER BY name, id DESC
  `;

  return c.json(result);
});

export { files };
