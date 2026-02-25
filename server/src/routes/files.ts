import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { type AppEnv, authMiddleware, memberOnly } from "../middleware.js";
import { UploadFileSchema } from "../schemas.js";
import {
  insertFile,
  getLatestFile,
  getFileHistory,
  deleteFile,
  listFiles,
} from "../repositories.js";

const files = new Hono<AppEnv>();

files.use("/api/projects/:id/files/*", authMiddleware);
files.use("/api/projects/:id/files", authMiddleware);

files.put("/api/projects/:id/files/:name", memberOnly, vValidator("json", UploadFileSchema), async (c) => {
  const projectId = c.req.param("id");
  const name = c.req.param("name");
  const { encryptedContent } = c.req.valid("json");

  await insertFile(projectId, name, encryptedContent);

  return c.json({ ok: true });
});

files.get("/api/projects/:id/files/:name/history", memberOnly, async (c) => {
  const projectId = c.req.param("id");
  const name = c.req.param("name");

  const result = await getFileHistory(projectId, name);

  return c.json(result);
});

files.get("/api/projects/:id/files/:name", memberOnly, async (c) => {
  const projectId = c.req.param("id");
  const name = c.req.param("name");

  const file = await getLatestFile(projectId, name);

  if (!file) return c.json({ error: "File not found" }, 404);

  return c.json({ encryptedContent: file.encrypted_content });
});

files.delete("/api/projects/:id/files/:name", memberOnly, async (c) => {
  const projectId = c.req.param("id");
  const name = c.req.param("name");

  const deleted = await deleteFile(projectId, name);

  if (!deleted) return c.json({ error: "File not found" }, 404);

  return c.json({ ok: true });
});

files.get("/api/projects/:id/files", memberOnly, async (c) => {
  const projectId = c.req.param("id");

  const result = await listFiles(projectId);

  return c.json(result);
});

export { files };
