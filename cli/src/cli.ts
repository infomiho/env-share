import { Command } from "commander";
import { loginCommand, logoutCommand, whoamiCommand } from "./commands/auth.js";
import { filesCommand } from "./commands/files.js";
import { initCommand } from "./commands/init.js";
import { membersCommand } from "./commands/members.js";
import { pullCommand } from "./commands/pull.js";
import { pushCommand } from "./commands/push.js";

const program = new Command()
  .name("env-share")
  .description("Encrypted .env sharing")
  .version("0.1.0");

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);
program.addCommand(initCommand);
program.addCommand(pushCommand);
program.addCommand(pullCommand);
program.addCommand(membersCommand);
program.addCommand(filesCommand);

program.parseAsync().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
