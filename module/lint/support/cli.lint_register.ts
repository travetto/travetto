import fs from 'node:fs/promises';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { JSONUtil, Runtime } from '@travetto/runtime';

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
    await fs.writeFile(outputLinterFilePath, JSONUtil.toUTF8Pretty(linterConfiguration) + '\n');
    console.log(`Wrote lint config to ${outputLinterFilePath}`);

    const formatterConfiguration = {
      $schema: './node_modules/oxfmt/configuration_schema.json',
      extends: [
        './node_modules/@travetto/lint/resources/oxfmtrc.json'
      ]
    };
    const outputFormatterFilePath = Runtime.workspaceRelative('.oxfmtrc.json');
    await fs.writeFile(outputFormatterFilePath, JSONUtil.toUTF8Pretty(formatterConfiguration) + '\n');
    console.log(`Wrote format config to ${outputFormatterFilePath}`);
  }
}
