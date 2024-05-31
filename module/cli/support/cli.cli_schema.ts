import { Env } from '@travetto/base';

import { CliCommand } from '../src/decorators';
import { CliCommandSchema, CliCommandShape, CliValidationError } from '../src/types';
import { CliCommandRegistry } from '../src/registry';
import { CliCommandSchemaUtil } from '../src/schema';
import { CliUtil } from '../src/util';

/**
 * Generates the schema for all CLI operations
 */
@CliCommand({ hidden: true })
export class CliSchemaCommand implements CliCommandShape {

  async #getSchema(name: string): Promise<CliCommandSchema> {
    const inst = await CliCommandRegistry.getInstance(name);
    return CliCommandSchemaUtil.getSchema(inst!);
  }

  async validate(names: string[]): Promise<CliValidationError | undefined> {
    for (const name of names ?? []) {
      if (name && !CliCommandRegistry.getCommandMapping().has(name)) {
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
      names = [...CliCommandRegistry.getCommandMapping().keys()];
    }
    const resolved = await Promise.all(names.map(x => this.#getSchema(x)));
    await CliUtil.writeAndEnsureComplete(resolved);
  }
}