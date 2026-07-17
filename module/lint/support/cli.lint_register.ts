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

    const formatterConfiguration = {
      $schema: './node_modules/oxfmt/configuration_schema.json',
      singleQuote: true,
      semi: true,
      tabWidth: 2,
      printWidth: 120,
      trailingComma: 'all'
    };
    const outputFormatterFilePath = Runtime.workspaceRelative('.oxfmtrc.json');
    await fs.writeFile(outputFormatterFilePath, JSON.stringify(formatterConfiguration, null, 2) + '\n');
    console.log(`Wrote oxfmt config to ${outputFormatterFilePath}`);
  }
}
