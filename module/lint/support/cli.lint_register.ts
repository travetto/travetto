import fs from 'node:fs/promises';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { Runtime } from '@travetto/runtime';

/**
 * Generate the workspace Oxlint configuration file.
 *
 * This bootstraps `.oxlintrc.json` with standard ignores.
 */
@CliCommand({})
export class LintConfigureCommand implements CliCommandShape {

  async main(): Promise<void> {
    const linterConfiguration = {
      $schema: './node_modules/oxlint/configuration_schema.json',
      extends: [
        './node_modules/@travetto/lint/resources/oxlintrc.json'
      ]
    };
    const outputLinterFilePath = Runtime.workspaceRelative('.oxlintrc.json');
    await fs.writeFile(outputLinterFilePath, JSON.stringify(linterConfiguration, null, 2) + '\n');
    console.log(`Wrote oxlint config to ${outputLinterFilePath}`);
  }
}
