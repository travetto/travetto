import fs from "node:fs/promises";

import { CliCommand, type CliCommandShape } from "@travetto/cli";
import { Runtime, RuntimeIndex } from "@travetto/runtime";

/**
 * Generate the workspace oxlint, oxfmt, and cspell configuration entry files.
 *
 * This bootstraps `oxlint.config.ts`, `oxfmt.config.ts`, and `cspell.json` to extend the framework-provided rules and formatting configuration.
 */
@CliCommand({})
export class LintRegisterCommand implements CliCommandShape {
  async main(): Promise<void> {
    const PREAMBLE = `process.env.TRV_MANIFEST= '${Runtime.stripWorkspacePath(Runtime.workspaceRelative(RuntimeIndex.outputRoot, "node_modules", Runtime.workspace.name))}';`;

    // Bootstrap oxlint configuration
    const oxlintOutput = Runtime.workspaceRelative("oxlint.config.js");
    if (!(await fs.stat(oxlintOutput, { throwIfNoEntry: false }))) {
      const entry = RuntimeIndex.getFromImport("@travetto/lint/support/oxlint");
      const content = `${PREAMBLE}
const { oxlintConfig } = await import('${Runtime.stripWorkspacePath(entry!.outputFile)}');
export default oxlintConfig();
`;
      await fs.writeFile(oxlintOutput, content);
      console.log(`Wrote lint config to ${oxlintOutput}`);
    } else {
      console.log(`Lint config already present ${oxlintOutput}`);
    }

    // Bootstrap oxfmt configuration
    const oxfmtOutput = Runtime.workspaceRelative("oxfmt.config.js");
    if (!(await fs.stat(oxfmtOutput, { throwIfNoEntry: false }))) {
      const entry = RuntimeIndex.getFromImport("@travetto/lint/support/oxfmt");
      const content = `${PREAMBLE}
const { oxfmtConfig } = await import('${Runtime.stripWorkspacePath(entry!.outputFile)}');
export default oxfmtConfig();
`;

      await fs.writeFile(oxfmtOutput, content);
      console.log(`Wrote format config to ${oxfmtOutput}`);
    } else {
      console.log(`Format config already present ${oxfmtOutput}`);
    }

    // Bootstrap cspell configuration
    const cspellOutput = Runtime.workspaceRelative("cspell.json");
    if (!(await fs.stat(cspellOutput, { throwIfNoEntry: false }))) {
      const cspellContent =
        JSON.stringify(
          {
            import: ["@travetto/lint/resources/cspell.json"],
          },
          null,
          2,
        ) + "\n";
      await fs.writeFile(cspellOutput, cspellContent);
      console.log(`Wrote cspell config to ${cspellOutput}`);
    } else {
      console.log(`CSpell config already present ${cspellOutput}`);
    }
  }
}
