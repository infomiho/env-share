import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { migrate } from "./db.js";
import { auth } from "./routes/auth.js";
import { projects } from "./routes/projects.js";
import { files } from "./routes/files.js";

const app = new Hono();

app.route("/", auth);
app.route("/", projects);
app.route("/", files);

app.get("/api/health", (c) => c.json({ ok: true }));

async function main() {
  await migrate();
  serve({ fetch: app.fetch, port: 3000 }, (info) => {
    console.log(`Server running on port ${info.port}`);
  });
}

main();
