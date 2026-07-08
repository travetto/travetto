import fs from 'node:fs/promises';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { Runtime } from '@travetto/runtime';

/**
 * Generate the workspace Biome configuration entry file.
 *
 * This bootstraps `biome.json` to extend the framework-provided rules configuration.
 */
@CliCommand({})
export class LintRegisterCommand implements CliCommandShape {
  async main(): Promise<void> {
    const content = `{
  "extends": ["./node_modules/@travetto/lint/biome.json"]
}
`;
    const output = Runtime.workspaceRelative('biome.json');
    await fs.writeFile(output, content);
    console.log(`Wrote biome config to ${output}`);
  }
}
