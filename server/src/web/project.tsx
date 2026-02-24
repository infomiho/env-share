import { Hono } from "hono";
import { sql, findUserByLogin } from "../db.js";
import type { AppEnv } from "../middleware.js";
import { Layout } from "./layout.js";
import { webAuthMiddleware } from "./middleware.js";
import { formatDate } from "./format.js";

const project = new Hono<AppEnv>();

project.use("*", webAuthMiddleware);

project.get("/:id", async (c) => {
  const user = c.get("user");
  const projectId = c.req.param("id");

  const [projectRow] = await sql`
    SELECT p.*, u.github_login as owner_login
    FROM projects p
    JOIN users u ON u.id = p.created_by
    WHERE p.id = ${projectId}
  `;

  if (!projectRow) {
    return c.html(
      <Layout user={user}>
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
      <Layout user={user}>
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
    <Layout user={user}>
      <div class="mt-6">
        <a href="/web" class="text-muted-foreground no-underline">
          &larr; Projects
        </a>
      </div>

      <h1 class="my-4">{projectRow.name}</h1>
      <p class="text-muted-foreground mb-6">
        Owned by <strong>{projectRow.owner_login}</strong>
      </p>

      {flash && (
        <div class="alert mb-4">
          <section>{flash}</section>
        </div>
      )}
      {error && (
        <div class="alert alert-destructive mb-4">
          <section>{error}</section>
        </div>
      )}

      <h2 class="mb-3">Members</h2>
      <table class="table mb-8">
        <thead>
          <tr>
            <th>Username</th>
            <th>Name</th>
            {isOwner && <th class="w-[1%]" />}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr>
              <td>{member.github_login}</td>
              <td>{member.github_name || "—"}</td>
              {isOwner && (
                <td>
                  {member.github_login !== user.github_login && (
                    <form
                      method="post"
                      action={`/web/projects/${projectId}/members/${member.github_login}/remove`}
                      onsubmit="return confirm('Remove this member?')"
                    >
                      <button class="btn btn-destructive" type="submit">
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <h2 class="mb-3">Files</h2>
      {files.length === 0 ? (
        <div class="text-center py-12 text-muted-foreground">
          <p>No files yet. Use <code>env-share push</code> to upload.</p>
        </div>
      ) : (
        <>
          <table class="table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr>
                  <td>{file.name}</td>
                  <td>{formatDate(file.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="mt-3 text-muted-foreground text-sm">
            Files are end-to-end encrypted. Use the CLI to push and pull.
          </p>
        </>
      )}
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
