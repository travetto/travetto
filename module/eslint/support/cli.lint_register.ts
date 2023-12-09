import fs from 'fs/promises';

import { CliCommandShape, CliCommand } from '@travetto/cli';
import { RuntimeContext } from '@travetto/manifest';

import { buildEslintConfig } from './bin/eslint-config-file';

/**
 * Writes the lint configuration file
 */
@CliCommand()
export class LintConfigureCommand implements CliCommandShape {

  async main(): Promise<void> {
    const content = await buildEslintConfig();
    const output = RuntimeContext.workspaceRelative('eslint.config.js');
    await fs.writeFile(output, content.replaceAll(RuntimeContext.workspacePath, '.').trim());

    console.log(`Wrote eslint config to ${output}`);
  }
}