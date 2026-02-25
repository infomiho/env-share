import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { aesDecrypt } from "../crypto.js";
import { apiRequest, createSpinner, loadProjectConfig, unwrapProjectKey } from "../lib.js";

export const pullCommand = new Command("pull")
  .description("Download and decrypt an env file")
  .argument("[file]", "File to pull", ".env")
  .action(async (file: string) => {
    const { projectId, serverUrl } = loadProjectConfig();
    const projectKey = await unwrapProjectKey(projectId, serverUrl);
    const fileName = path.basename(file);

    const spinner = createSpinner(`Pulling ${fileName}`);
    spinner.start();

    const { encryptedContent } = await apiRequest<{ encryptedContent: string }>(
      "GET",
      `/api/projects/${projectId}/files/${fileName}`,
      { serverUrl },
    );

    const decrypted = aesDecrypt(encryptedContent, projectKey);
    fs.writeFileSync(path.resolve(file), decrypted);

    spinner.stop(`✓ Pulled ${fileName}.`);
  });
