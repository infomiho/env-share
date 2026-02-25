import { Hono } from "hono";
import { sql } from "../db.js";
import type { AppEnv } from "../middleware.js";
import { formatDate } from "./format.js";
import { Layout } from "./layout.js";
import { webAuthMiddleware } from "./middleware.js";

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

  const origin = new URL(c.req.url).origin;
  return c.html(
    <Layout user={user} origin={origin} title="Projects — env-share">
      <h1 class="h1 mt-6 mb-4">Projects</h1>
      {projects.length === 0 ? (
        <section class="flex items-center justify-center min-h-60 bg-card text-card-foreground border shadow-sm rounded-xl p-4">
          <div class="text-center max-w-sm">
            <h2 class="h4">No projects yet.</h2>
            <p class="text-muted-foreground mt-1">
              Use the CLI to create a project: <code>env-share init --server {origin}</code>
            </p>
          </div>
        </section>
      ) : (
        <ul>
          {projects.map((proj) => (
            <li class="flex items-center border border-b-0 last:border-b first:rounded-t-xl last:rounded-b-xl px-4 h-12 text-sm hover:bg-muted/50 transition-colors">
              <a href={`/web/projects/${proj.id}`} class="font-medium">
                {proj.name}
              </a>
              <span class="ml-auto text-muted-foreground">{formatDate(proj.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Layout>,
  );
});

export { dashboard };
