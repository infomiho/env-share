import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import * as v from "valibot";
import { sql } from "../db.js";
import { fetchGitHubUserByLogin, upsertUser } from "../github.js";
import type { AppEnv } from "../middleware.js";
import { findUserByLogin, upsertMember } from "../repositories.js";
import { Terminal } from "./components.js";
import { consumeFlash, setFlash, setFlashError } from "./flash.js";
import { formatDate } from "./format.js";
import { Layout } from "./layout.js";
import { webAuthMiddleware } from "./middleware.js";

const AddMemberFormSchema = v.object({
  username: v.pipe(v.string(), v.trim(), v.nonEmpty()),
});

const project = new Hono<AppEnv>();

project.use("*", webAuthMiddleware);

project.get("/:id", async (c) => {
  const user = c.get("user");
  const origin = new URL(c.req.url).origin;
  const projectId = c.req.param("id");

  const [projectRow] = await sql`
    SELECT p.*, u.github_login as owner_login
    FROM projects p
    JOIN users u ON u.id = p.created_by
    WHERE p.id = ${projectId}
  `;

  if (!projectRow) {
    return c.html(
      <Layout user={user} origin={origin}>
        <div class="alert alert-destructive mt-6">
          <h2>Not found</h2>
          <section>Project not found.</section>
        </div>
      </Layout>,
      404,
    );
  }

  const [membership] = await sql`
    SELECT 1 FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${user.id}
    AND encrypted_project_key IS NOT NULL
  `;

  if (!membership) {
    return c.html(
      <Layout user={user} origin={origin}>
        <div class="alert alert-destructive mt-6">
          <h2>Access denied</h2>
          <section>You are not a member of this project.</section>
        </div>
      </Layout>,
      403,
    );
  }

  const isOwner = projectRow.created_by === user.id;

  const members = await sql`
    SELECT u.github_login, u.github_name,
           (pm.encrypted_project_key IS NULL) AS pending
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ${projectId}
    ORDER BY u.github_login
  `;

  const files = await sql`
    SELECT DISTINCT ON (name) name, created_at
    FROM files
    WHERE project_id = ${projectId}
    ORDER BY name, id DESC
  `;

  const { flash, error } = consumeFlash(c);

  return c.html(
    <Layout user={user} origin={origin} title={`${projectRow.name} — env-share`}>
      <div class="mt-6 space-y-8">
        <div>
          <a href="/web" class="text-sm text-muted-foreground hover:text-foreground no-underline">
            &larr; Projects
          </a>
        </div>

        <div>
          <h1 class="h1">{projectRow.name}</h1>
          <p class="text-muted-foreground mt-1">
            Owned by <strong>{projectRow.owner_login}</strong>
          </p>
        </div>

        {flash && (
          <div class="alert">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <section>{flash}</section>
          </div>
        )}
        {error && (
          <div class="alert-destructive">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <section>{error}</section>
          </div>
        )}

        {/* Members */}
        <div>
          <div class="flex justify-between items-center mb-3">
            <h2 class="h4">Members</h2>
            <span class="text-sm text-muted-foreground">({members.length})</span>
          </div>
          <ul class="border rounded-xl divide-y">
            {members.map((member) => (
              <li class="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                <div class="flex items-center gap-3">
                  <span class="font-medium">{member.github_login}</span>
                  {member.github_name && (
                    <span class="text-sm text-muted-foreground">{member.github_name}</span>
                  )}
                  {member.pending ? (
                    <span class="badge-outline">Pending</span>
                  ) : (
                    <span class="badge-secondary">Active</span>
                  )}
                </div>
                {isOwner && member.github_login !== user.github_login && (
                  <form
                    method="post"
                    action={`/web/projects/${projectId}/members/${member.github_login}/remove`}
                    onsubmit="return confirm('Remove this member?')"
                  >
                    <button class="btn btn-sm btn-destructive" type="submit">
                      Remove
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {isOwner && (
            <form
              method="post"
              action={`/web/projects/${projectId}/members/add`}
              class="flex items-center gap-x-2 mt-3"
            >
              <input
                type="text"
                name="username"
                class="input flex-1"
                placeholder="GitHub username"
                required
              />
              <button type="submit" class="btn btn-sm">
                Add
              </button>
            </form>
          )}
        </div>

        {/* Files */}
        <div>
          <div class="flex justify-between items-center mb-3">
            <h2 class="h4">Files</h2>
            <span class="text-sm text-muted-foreground">({files.length})</span>
          </div>
          {files.length === 0 ? (
            <section class="flex items-center justify-center min-h-60 bg-card text-card-foreground border shadow-sm rounded-xl p-4">
              <div class="text-center max-w-sm">
                <h2 class="h4">No files yet.</h2>
                <p class="text-muted-foreground mt-1">
                  Use <code>env-share push</code> to upload encrypted files.
                </p>
              </div>
            </section>
          ) : (
            <>
              <ul class="border rounded-xl divide-y">
                {files.map((file) => (
                  <li class="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                    <span class="font-medium font-mono text-sm">{file.name}</span>
                    <span class="text-sm text-muted-foreground">{formatDate(file.created_at)}</span>
                  </li>
                ))}
              </ul>
              <div class="mt-3">
                <Terminal
                  commands={["npx @infomiho/env-share push .env", "npx @infomiho/env-share pull"]}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>,
  );
});

project.post(
  "/:id/members/add",
  vValidator("form", AddMemberFormSchema, (result, c) => {
    if (!result.success) {
      const projectId = c.req.param("id");
      setFlashError(c, "Username is required");
      return c.redirect(`/web/projects/${projectId}`);
    }
  }),
  async (c) => {
    const user = c.get("user");
    const projectId = c.req.param("id");
    const redirectUrl = `/web/projects/${projectId}`;

    const [ownerCheck] = await sql`
      SELECT 1 FROM projects WHERE id = ${projectId} AND created_by = ${user.id}
    `;

    if (!ownerCheck) {
      setFlashError(c, "Not the owner");
      return c.redirect(redirectUrl);
    }

    const { username } = c.req.valid("form");

    const [existing] = await sql`
      SELECT 1 FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ${projectId} AND u.github_login = ${username}
    `;

    if (existing) {
      setFlashError(c, `${username} is already a member`);
      return c.redirect(redirectUrl);
    }

    let targetUser = await findUserByLogin(username);

    if (!targetUser) {
      const ghUser = await fetchGitHubUserByLogin(username);
      if (!ghUser) {
        setFlashError(c, "GitHub user not found");
        return c.redirect(redirectUrl);
      }
      targetUser = await upsertUser(ghUser);
    }

    await upsertMember(projectId, targetUser.id, null);

    setFlash(c, `Added ${username} as a pending member`);
    return c.redirect(redirectUrl);
  },
);

project.post("/:id/members/:username/remove", async (c) => {
  const user = c.get("user");
  const projectId = c.req.param("id");
  const username = c.req.param("username");
  const redirectUrl = `/web/projects/${projectId}`;

  const [ownerCheck] = await sql`
    SELECT 1 FROM projects WHERE id = ${projectId} AND created_by = ${user.id}
  `;

  if (!ownerCheck) {
    setFlashError(c, "Not the owner");
    return c.redirect(redirectUrl);
  }

  if (username === user.github_login) {
    setFlashError(c, "Cannot remove yourself");
    return c.redirect(redirectUrl);
  }

  const targetUser = await findUserByLogin(username);
  if (!targetUser) {
    setFlashError(c, "User not found");
    return c.redirect(redirectUrl);
  }

  await sql`
    DELETE FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${targetUser.id}
  `;

  setFlash(c, `Removed ${username} from project`);
  return c.redirect(redirectUrl);
});

export { project };
