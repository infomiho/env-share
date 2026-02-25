import path from "node:path";
import { Command } from "commander";
import { eciesEncrypt, generateProjectKey } from "../crypto.js";
import {
  apiRequest,
  createSpinner,
  normalizeServerUrl,
  saveProjectConfig,
  type UserInfo,
} from "../lib.js";

export const initCommand = new Command("init")
  .description("Initialize a new project in the current directory")
  .requiredOption("--server <url>", "Server URL")
  .action(async (opts) => {
    const serverUrl = normalizeServerUrl(opts.server);

    const me = await apiRequest<UserInfo>("GET", "/api/auth/me", { serverUrl });
    if (!me.public_key) {
      throw new Error("No public key on server. Run 'env-share login' again.");
    }

    const projectKey = generateProjectKey();
    const encryptedProjectKey = eciesEncrypt(projectKey, Buffer.from(me.public_key, "base64"));
    const projectName = path.basename(process.cwd());

    const spinner = createSpinner("Creating project");
    spinner.start();

    const project = await apiRequest<{ id: string }>("POST", "/api/projects", {
      body: { name: projectName, encryptedProjectKey },
      serverUrl,
    });

    saveProjectConfig({ projectId: project.id, serverUrl });

    spinner.stop(`✓ Project "${projectName}" created (${project.id}).`);
  });
