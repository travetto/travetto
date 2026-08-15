import fs from 'node:fs/promises';

import { CliCommand, type CliCommandShape } from '@travetto/cli';
import { FileLoader, JSONUtil, Runtime } from '@travetto/runtime';

/**
 * Generate the workspace Biome configuration entry file.
 *
 * This bootstraps `biome.json` to extend the framework-provided rules configuration.
 */
@CliCommand({})
export class LintRegisterCommand implements CliCommandShape {
  async main(): Promise<void> {
    const resource = new FileLoader([Runtime.modulePath('@travetto/lint#resources')]);
    const config: { $schema: string } = JSONUtil.fromUTF8(await resource.readUTF8('biome.json'));
    const content = {
      $schema: config.$schema,
      extends: ['./node_modules/@travetto/lint/resources/biome.json']
    };
    const output = Runtime.workspaceRelative('biome.json');
    if (!(await fs.stat(output, { throwIfNoEntry: false }))) {
      await fs.writeFile(output, JSONUtil.toUTF8Pretty(content));
      console.log(`Wrote lint config to ${output}`);
    } else {
      console.log(`Lint config already present ${output}`);
    }
  }
}
