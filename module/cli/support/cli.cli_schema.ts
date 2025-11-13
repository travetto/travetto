import { Env } from '@travetto/runtime';

import { CliCommand } from '../src/registry/decorator.ts';
import { CliCommandShape, CliValidationError } from '../src/types.ts';
import { CliCommandRegistryIndex } from '../src/registry/registry-index.ts';
import { CliUtil } from '../src/util.ts';

/**
 * Generates the schema for all CLI operations
 */
@CliCommand({ hidden: true })
export class CliSchemaCommand implements CliCommandShape {

  async validate(names: string[]): Promise<CliValidationError | undefined> {
    for (const name of names ?? []) {
      if (name && !CliCommandRegistryIndex.hasCommand(name)) {
        return {
          source: 'arg',
          message: `name: ${name} is not a valid cli command`
        };
      }
    }
  }

  preMain(): void {
    Env.DEBUG.set(false);
  }

  async main(names?: string[]): Promise<void> {
    const resolved = await CliCommandRegistryIndex.load(names);
    const output = JSON.stringify(resolved.map(x => x.config), (key, value) => {
      if (typeof value === 'function') {
        return undefined;
      }
      return value;
    }, 2);
    await CliUtil.writeAndEnsureComplete(output);
  }
}