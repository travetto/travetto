import fs from 'node:fs/promises';

import { CliCommandShape, CliCommand } from '@travetto/cli';
import { Runtime } from '@travetto/runtime';

import { buildEslintConfig } from './bin/eslint-config-file.ts';

/**
 * Writes the lint configuration file
 */
@CliCommand({})
export class LintConfigureCommand implements CliCommandShape {

  async main(): Promise<void> {
    const content = await buildEslintConfig();
    const ext = Runtime.workspace.type === 'commonjs' ? '.cjs' : '.mjs';
    const output = Runtime.workspaceRelative(`eslint.config${ext}`);
    await fs.writeFile(output, content.replaceAll(Runtime.workspace.path, '.').trim());
    console.log(`Wrote eslint config to ${output}`);
  }
}