import fs from "node:fs/promises";

import { CliCommand, type CliCommandShape } from "@travetto/cli";
import { Runtime } from "@travetto/runtime";

/**
 * Generate the workspace Biome configuration entry file.
 *
 * This bootstraps `biome.jsonc` to extend the framework-provided rules configuration.
 */
@CliCommand({})
export class LintRegisterCommand implements CliCommandShape {
  async main(): Promise<void> {
    const content = `{
  "$schema": "https://biomejs.dev/schemas/2.5.4/schema.json",
  "extends": ["./node_modules/@travetto/lint/resources/biome.jsonc"]
}
`;
    const output = Runtime.workspaceRelative("biome.jsonc");
    if (!(await fs.stat(output, { throwIfNoEntry: false }))) {
      await fs.writeFile(output, content);
      console.log(`Wrote lint config to ${output}`);
    } else {
      console.log(`Lint config already present ${output}`);
    }
  }
}
