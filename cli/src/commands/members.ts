import { Command } from "commander";
import { eciesEncrypt } from "../crypto.js";
import {
  apiRequest,
  createSpinner,
  loadProjectConfig,
  resolvePendingMembers,
  unwrapProjectKey,
} from "../lib.js";

interface Member {
  github_login: string;
  github_name: string | null;
  pending: boolean;
}

const addCommand = new Command("add")
  .description("Add a member to the project")
  .argument("<username>", "GitHub username to add")
  .action(async (username: string) => {
    const { projectId } = loadProjectConfig();

    let encryptedProjectKey: string | undefined;
    try {
      const { publicKey } = await apiRequest<{ publicKey: string | null }>(
        "GET",
        `/api/projects/${projectId}/members/${username}/public-key`,
      );
      if (publicKey) {
        const projectKey = await unwrapProjectKey(projectId);
        encryptedProjectKey = eciesEncrypt(projectKey, Buffer.from(publicKey, "base64"));
      }
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("(404)"))) throw err;
    }

    const spinner = createSpinner(`Adding ${username}`);
    spinner.start();

    const { pending } = await apiRequest<{ ok: boolean; pending: boolean }>(
      "POST",
      `/api/projects/${projectId}/members`,
      { username, ...(encryptedProjectKey ? { encryptedProjectKey } : {}) },
    );

    if (pending) {
      spinner.stop(`✓ Added ${username} as a pending member.`);
    } else {
      spinner.stop(`✓ Added ${username} to the project.`);
    }
  });

const removeCommand = new Command("remove")
  .description("Remove a member from the project")
  .argument("<username>", "GitHub username to remove")
  .action(async (username: string) => {
    const { projectId } = loadProjectConfig();

    const spinner = createSpinner(`Removing ${username}`);
    spinner.start();

    await apiRequest("DELETE", `/api/projects/${projectId}/members/${username}`);

    spinner.stop(`✓ Removed ${username} from the project.`);
  });

const listCommand = new Command("list").description("List project members").action(async () => {
  const { projectId } = loadProjectConfig();
  const members = await apiRequest<Member[]>("GET", `/api/projects/${projectId}/members`);

  for (const member of members) {
    const name = member.github_name ? ` (${member.github_name})` : "";
    const tag = member.pending ? " [pending]" : "";
    console.log(`${member.github_login}${name}${tag}`);
  }
  console.log(`\n${members.length} member${members.length === 1 ? "" : "s"}`);
});

const provisionKeysCommand = new Command("provision-keys")
  .description("Provision keys for pending members")
  .action(async () => {
    const { projectId } = loadProjectConfig();
    const projectKey = await unwrapProjectKey(projectId);

    const spinner = createSpinner("Provisioning pending members");
    spinner.start();

    const count = await resolvePendingMembers(projectId, projectKey);

    if (count > 0) {
      spinner.stop(`✓ Provisioned ${count} pending member${count === 1 ? "" : "s"}.`);
    } else {
      spinner.stop("✓ No pending members to provision.");
    }
  });

export const membersCommand = new Command("members").description("Manage project members");

membersCommand.addCommand(addCommand);
membersCommand.addCommand(removeCommand);
membersCommand.addCommand(listCommand);
membersCommand.addCommand(provisionKeysCommand);
