import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { migrate } from "./db.js";
import { auth } from "./routes/auth.js";
import { projects } from "./routes/projects.js";
import { files } from "./routes/files.js";
import { webAuth } from "./web/auth.js";
import { dashboard } from "./web/dashboard.js";
import { project } from "./web/project.js";
import { og } from "./web/og.js";

const app = new Hono();

app.route("/", auth);
app.route("/", projects);
app.route("/", files);

app.route("/web", webAuth);
app.route("/web", og);
app.route("/web", dashboard);
app.route("/web/projects", project);

app.get("/", (c) => c.redirect("/web"));

app.get("/api/health", (c) => c.json({ ok: true }));

async function main() {
  await migrate();
  serve({ fetch: app.fetch, port: 3000 }, (info) => {
    console.log(`Server running on port ${info.port}`);
  });
}

main();
