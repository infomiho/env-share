import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { aesEncrypt } from "../crypto.js";
import { apiRequest, createSpinner, loadProjectConfig, unwrapProjectKey } from "../lib.js";

export const pushCommand = new Command("push")
  .description("Encrypt and upload an env file")
  .argument("[file]", "File to push", ".env")
  .action(async (file: string) => {
    const { projectId } = loadProjectConfig();

    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath);
    const projectKey = await unwrapProjectKey(projectId);
    const encryptedContent = aesEncrypt(content, projectKey);
    const fileName = path.basename(file);

    const spinner = createSpinner(`Pushing ${fileName}`);
    spinner.start();

    await apiRequest("PUT", `/api/projects/${projectId}/files/${fileName}`, {
      encryptedContent,
    });

    spinner.stop(`✓ Pushed ${fileName}.`);
  });
