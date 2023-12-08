import fs from 'fs/promises';

import { CliCommandShape, CliCommand } from '@travetto/cli';
import { path, RuntimeContext } from '@travetto/manifest';

import { buildEslintConfig } from './bin/eslint-config-file';

/**
 * Writes the lint configuration file
 */
@CliCommand()
export class LintConfigureCommand implements CliCommandShape {

  async main(): Promise<void> {
    const content = buildEslintConfig();
    const output = path.resolve(RuntimeContext.workspacePath, 'eslint.config.js');
    await fs.writeFile(output, content.replaceAll(RuntimeContext.workspacePath, '.').trim());

    console.log(`Wrote eslint config to ${output}`);
  }
}