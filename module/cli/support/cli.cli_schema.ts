import { Env } from '@travetto/runtime';

import { CliCommand } from '../src/registry/decorator.ts';
import { CliCommandSchema, CliCommandShape, CliValidationError } from '../src/types.ts';
import { CliCommandRegistryIndex } from '../src/registry/registry-index.ts';
import { CliCommandSchemaUtil } from '../src/schema.ts';
import { CliUtil } from '../src/util.ts';

/**
 * Generates the schema for all CLI operations
 */
@CliCommand({ hidden: true })
export class CliSchemaCommand implements CliCommandShape {

  async #getSchema(name: string): Promise<CliCommandSchema> {
    const inst = await CliCommandRegistryIndex.getInstance(name);
    return CliCommandSchemaUtil.getSchema(inst);
  }

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
    if (!names?.length) {
      names = CliCommandRegistryIndex.getCommandList();
    }
    const resolved = await Promise.all(names.map(x => this.#getSchema(x)));
    await CliUtil.writeAndEnsureComplete(resolved);
  }
}