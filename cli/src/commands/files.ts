import { Command } from "commander";
import { apiRequest, createSpinner, loadProjectConfig } from "../lib.js";

interface FileEntry {
  name: string;
  created_at: string;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Date(date).toISOString().slice(0, 10);
}

const listCommand = new Command("list").description("List project files").action(async () => {
  const { projectId } = loadProjectConfig();
  const files = await apiRequest<FileEntry[]>("GET", `/api/projects/${projectId}/files`);

  if (files.length === 0) {
    console.log("No files.");
    return;
  }

  const maxName = Math.max(...files.map((f) => f.name.length));

  for (const file of files) {
    console.log(`${file.name.padEnd(maxName + 2)}${timeAgo(file.created_at)}`);
  }

  console.log(`\n${files.length} file${files.length === 1 ? "" : "s"}`);
});

const deleteCommand = new Command("delete")
  .description("Delete a file from the project")
  .argument("<name>", "File name to delete")
  .action(async (name: string) => {
    const { projectId } = loadProjectConfig();

    const spinner = createSpinner(`Deleting ${name}`);
    spinner.start();

    await apiRequest("DELETE", `/api/projects/${projectId}/files/${name}`);

    spinner.stop(`✓ Deleted ${name}.`);
  });

interface HistoryEntry {
  id: number;
  created_at: string;
}

const historyCommand = new Command("history")
  .description("Show version history for a file")
  .argument("<name>", "File name")
  .action(async (name: string) => {
    const { projectId } = loadProjectConfig();
    const versions = await apiRequest<HistoryEntry[]>(
      "GET",
      `/api/projects/${projectId}/files/${name}/history`,
    );

    if (versions.length === 0) {
      console.log("No versions found.");
      return;
    }

    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      const versionNumber = versions.length - i;
      const label = i === 0 ? " (latest)" : "";
      console.log(`v${versionNumber}  ${timeAgo(version.created_at)}${label}`);
    }

    console.log(`\n${versions.length} version${versions.length === 1 ? "" : "s"}`);
  });

export const filesCommand = new Command("files").description("Manage project files");

filesCommand.addCommand(listCommand);
filesCommand.addCommand(deleteCommand);
filesCommand.addCommand(historyCommand);
