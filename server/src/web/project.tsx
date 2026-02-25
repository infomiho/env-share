import { Hono } from "hono";
import { sql, findUserByLogin } from "../db.js";
import type { AppEnv } from "../middleware.js";
import { Layout } from "./layout.js";
import { Terminal } from "./components.js";
import { webAuthMiddleware } from "./middleware.js";
import { formatDate } from "./format.js";

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
      404
    );
  }

  const [membership] = await sql`
    SELECT 1 FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${user.id}
  `;

  if (!membership) {
    return c.html(
      <Layout user={user} origin={origin}>
        <div class="alert alert-destructive mt-6">
          <h2>Access denied</h2>
          <section>You are not a member of this project.</section>
        </div>
      </Layout>,
      403
    );
  }

  const isOwner = projectRow.created_by === user.id;

  const members = await sql`
    SELECT u.github_login, u.github_name
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

  const flash = c.req.query("flash");
  const error = c.req.query("error");

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
            <section>{flash}</section>
          </div>
        )}
        {error && (
          <div class="alert alert-destructive">
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
                <Terminal commands={[
                  "npx @infomiho/env-share push .env",
                  "npx @infomiho/env-share pull",
                ]} />
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
});

project.post("/:id/members/:username/remove", async (c) => {
  const user = c.get("user");
  const projectId = c.req.param("id");
  const username = c.req.param("username");

  const [ownerCheck] = await sql`
    SELECT 1 FROM projects WHERE id = ${projectId} AND created_by = ${user.id}
  `;

  if (!ownerCheck) {
    return c.redirect(`/web/projects/${projectId}?error=Not+the+owner`);
  }

  if (username === user.github_login) {
    return c.redirect(`/web/projects/${projectId}?error=Cannot+remove+yourself`);
  }

  const targetUser = await findUserByLogin(username);
  if (!targetUser) {
    return c.redirect(`/web/projects/${projectId}?error=User+not+found`);
  }

  await sql`
    DELETE FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${targetUser.id}
  `;

  return c.redirect(
    `/web/projects/${projectId}?flash=Removed+${username}+from+project`
  );
});

export { project };
