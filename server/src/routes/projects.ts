import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import crypto from "node:crypto";
import {
  type AppEnv,
  authMiddleware,
  memberOnly,
  ownerOnly,
} from "../middleware.js";
import { CreateProjectSchema, AddMemberSchema } from "../schemas.js";
import {
  createProjectWithMember,
  findProject,
  findMemberKey,
  findUserByLogin,
  upsertMember,
  removeMember,
  listMembers,
} from "../repositories.js";

const projects = new Hono<AppEnv>();

projects.use("/api/projects/*", authMiddleware);

projects.post("/api/projects", vValidator("json", CreateProjectSchema), async (c) => {
  const { name, encryptedProjectKey } = c.req.valid("json");
  const user = c.get("user");
  const id = "p_" + crypto.randomBytes(16).toString("hex");

  await createProjectWithMember(id, name, user.id, encryptedProjectKey);

  return c.json({ id, name });
});

projects.get("/api/projects/:id", memberOnly, async (c) => {
  const projectId = c.req.param("id");
  const project = await findProject(projectId);

  if (!project) return c.json({ error: "Not found" }, 404);
  return c.json(project);
});

projects.get("/api/projects/:id/key", memberOnly, async (c) => {
  const projectId = c.req.param("id");
  const user = c.get("user");

  const encryptedProjectKey = await findMemberKey(projectId, user.id);

  return c.json({ encryptedProjectKey });
});

projects.post("/api/projects/:id/members", ownerOnly, vValidator("json", AddMemberSchema), async (c) => {
  const projectId = c.req.param("id");
  const { username, encryptedProjectKey } = c.req.valid("json");

  const targetUser = await findUserByLogin(username);
  if (!targetUser) return c.json({ error: "User not found" }, 404);

  await upsertMember(projectId, targetUser.id, encryptedProjectKey);

  return c.json({ ok: true });
});

projects.delete("/api/projects/:id/members/:username", ownerOnly, async (c) => {
  const projectId = c.req.param("id");
  const username = c.req.param("username");

  const targetUser = await findUserByLogin(username);
  if (!targetUser) return c.json({ error: "User not found" }, 404);

  await removeMember(projectId, targetUser.id);

  return c.json({ ok: true });
});

projects.get("/api/projects/:id/members", memberOnly, async (c) => {
  const projectId = c.req.param("id");

  const members = await listMembers(projectId);

  return c.json(members);
});

projects.get("/api/projects/:id/members/:username/public-key", memberOnly, async (c) => {
  const username = c.req.param("username");

  const user = await findUserByLogin(username);
  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json({ publicKey: user.public_key });
});

export { projects };
