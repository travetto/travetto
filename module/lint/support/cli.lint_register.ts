import fs from 'node:fs/promises';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { Runtime } from '@travetto/runtime';

/**
 * Generate the workspace oxlint, oxfmt, and cspell configuration entry files.
 *
 * This bootstraps `oxlint.config.ts`, `oxfmt.config.ts`, and `cspell.json` to extend the framework-provided rules and formatting configuration.
 */
@CliCommand({})
export class LintRegisterCommand implements CliCommandShape {
  async main(): Promise<void> {
    // Bootstrap oxlint configuration
    const oxlintOutput = Runtime.workspaceRelative('oxlint.config.ts');
    if (!(await fs.stat(oxlintOutput, { throwIfNoEntry: false }))) {
      const oxlintContent = `import { oxlintConfig } from '@travetto/lint';

export default oxlintConfig();
`;
      await fs.writeFile(oxlintOutput, oxlintContent);
      console.log(`Wrote lint config to ${oxlintOutput}`);
    } else {
      console.log(`Lint config already present ${oxlintOutput}`);
    }

    // Bootstrap oxfmt configuration
    const oxfmtOutput = Runtime.workspaceRelative('oxfmt.config.ts');
    if (!(await fs.stat(oxfmtOutput, { throwIfNoEntry: false }))) {
      const oxfmtContent = `import { oxfmtConfig } from '@travetto/lint';

export default oxfmtConfig();
`;
      await fs.writeFile(oxfmtOutput, oxfmtContent);
      console.log(`Wrote format config to ${oxfmtOutput}`);
    } else {
      console.log(`Format config already present ${oxfmtOutput}`);
    }

    // Bootstrap cspell configuration
    const cspellOutput = Runtime.workspaceRelative('cspell.json');
    if (!(await fs.stat(cspellOutput, { throwIfNoEntry: false }))) {
      const cspellContent =
        JSON.stringify(
          {
            import: ['@travetto/lint/resources/cspell.json']
          },
          null,
          2
        ) + '\n';
      await fs.writeFile(cspellOutput, cspellContent);
      console.log(`Wrote cspell config to ${cspellOutput}`);
    } else {
      console.log(`CSpell config already present ${cspellOutput}`);
    }
  }
}
