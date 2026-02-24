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
    ON CONFLICT (project_id, name) DO UPDATE SET
      encrypted_content = EXCLUDED.encrypted_content,
      updated_at = now()
  `;

  return c.json({ ok: true });
});

files.get("/api/projects/:id/files/:name", async (c) => {
  if (!(await requireMember(c))) return c.res;

  const projectId = c.req.param("id");
  const name = c.req.param("name");

  const [file] = await sql`
    SELECT encrypted_content FROM files
    WHERE project_id = ${projectId} AND name = ${name}
  `;

  if (!file) return c.json({ error: "File not found" }, 404);

  return c.json({ encryptedContent: file.encrypted_content });
});

files.get("/api/projects/:id/files", async (c) => {
  if (!(await requireMember(c))) return c.res;

  const projectId = c.req.param("id");

  const result = await sql`
    SELECT name, updated_at FROM files
    WHERE project_id = ${projectId}
    ORDER BY name
  `;

  return c.json(result);
});

export { files };
