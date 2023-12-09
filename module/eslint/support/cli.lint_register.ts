import fs from 'fs/promises';

import { CliCommandShape, CliCommand } from '@travetto/cli';
import { path, RootIndex } from '@travetto/manifest';

import { buildEslintConfig } from './bin/eslint-config-file';

/**
 * Writes the lint configuration file
 */
@CliCommand()
export class LintConfigureCommand implements CliCommandShape {

  async main(): Promise<void> {
    const content = buildEslintConfig();
    const output = path.resolve(RootIndex.manifest.workspacePath, 'eslint.config.js');
    await fs.writeFile(output, content.replaceAll(RootIndex.manifest.workspacePath, '.').trim());

    console.log(`Wrote eslint config to ${output}`);
  }
}