import fs from 'node:fs/promises';

import { type CliCommandShape, CliCommand } from '@travetto/cli';
import { Runtime, RuntimeIndex } from '@travetto/runtime';

/**
 * Writes the eslint configuration file
 */
@CliCommand({})
export class ESLintConfigureCommand implements CliCommandShape {

  async main(): Promise<void> {
    const entry = RuntimeIndex.getFromImport('@travetto/eslint/support/bin/eslint-config');
    const content = `
process.env.TRV_MANIFEST = '${Runtime.workspaceRelative(RuntimeIndex.outputRoot, 'node_modules', Runtime.workspace.name)}';
const { rules } = await import('${entry?.outputFile}');
export { rules as default };
`;
    const output = Runtime.workspaceRelative('eslint.config.js');
    await fs.writeFile(output, content.replaceAll(Runtime.workspace.path, '.').trim());
    console.log(`Wrote eslint config to ${output}`);
  }
}