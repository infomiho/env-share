import { Hono } from "hono";
import { sql } from "../db.js";
import type { AppEnv } from "../middleware.js";
import { Layout } from "./layout.js";
import { webAuthMiddleware } from "./middleware.js";
import { formatDate } from "./format.js";

const dashboard = new Hono<AppEnv>();

dashboard.use("*", webAuthMiddleware);

dashboard.get("/", async (c) => {
  const user = c.get("user");

  const projects = await sql`
    SELECT p.id, p.name, p.created_at, p.created_by
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = ${user.id}
    ORDER BY p.created_at DESC
  `;

  return c.html(
    <Layout user={user}>
      <h1 class="mt-6 mb-4">Projects</h1>
      {projects.length === 0 ? (
        <div class="text-center py-12 text-muted-foreground">
          <p>No projects yet.</p>
          <p class="mt-2">
            Use the CLI to create a project: <code>env-share init</code>
          </p>
        </div>
      ) : (
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((proj) => (
              <tr>
                <td>
                  <a href={`/web/projects/${proj.id}`}>{proj.name}</a>
                </td>
                <td>{formatDate(proj.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
});

export { dashboard };
