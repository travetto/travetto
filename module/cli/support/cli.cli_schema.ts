import { describeFunction, Env } from '@travetto/runtime';

import { CliCommand } from '../src/registry/decorator.ts';
import { CliCommandShape, CliValidationError } from '../src/types.ts';
import { CliCommandRegistryIndex } from '../src/registry/registry-index.ts';
import { CliUtil } from '../src/util.ts';

/**
 * Generates the schema for all CLI operations
 */
@CliCommand({ hidden: true })
export class CliSchemaCommand implements CliCommandShape {

  async validate(names?: string[]): Promise<CliValidationError | undefined> {
    if (!names || names.length === 0) {
      return;
    }
    const resolved = await CliCommandRegistryIndex.load(names);
    const invalid = names.find(x => !resolved.find(r => r.command === x));

    if (invalid) {
      return {
        source: 'arg',
        message: `name: ${invalid} is not a valid cli command`
      };
    }
  }

  preMain(): void {
    Env.DEBUG.set(false);
  }

  async main(names?: string[]): Promise<void> {
    const resolved = await CliCommandRegistryIndex.load(names);
    const output = resolved
      .map(x => x.config)
      .map(({ cls, preMain: _preMain, ...x }) => ({ ...x, module: describeFunction(cls).module }));
    await CliUtil.writeAndEnsureComplete(output);
  }
}