import { Env } from '@travetto/runtime';
import { IsPrivate, MethodValidator, type ValidationError } from '@travetto/schema';

import { CliCommand } from '../src/registry/decorator.ts';
import type { CliCommandShape } from '../src/types.ts';
import { CliCommandRegistryIndex } from '../src/registry/registry-index.ts';
import { CliUtil } from '../src/util.ts';
import { CliSchemaExportUtil } from '../src/schema-export.ts';

async function nameValidator(names?: string[]): Promise<ValidationError | undefined> {
  if (!names || names.length === 0) {
    return;
  }
  const resolved = await CliCommandRegistryIndex.load(names);
  const invalid = names.find(name => !resolved.find(result => result.command === name));

  if (invalid) {
    return {
      source: 'arg',
      kind: 'invalid',
      path: 'names',
      message: `name: ${invalid} is not a valid cli command`
    };
  }
}

/**
 * Generates the schema for all CLI operations
 */
@CliCommand()
@IsPrivate()
export class CliSchemaCommand implements CliCommandShape {

  finalize(): void {
    Env.DEBUG.set(false);
  }

  @MethodValidator(nameValidator)
  async main(names?: string[]): Promise<void> {
    const resolved = await CliCommandRegistryIndex.load(names);

    const output = resolved
      .map(result => CliSchemaExportUtil.exportSchema(result.config.cls));

    await CliUtil.writeAndEnsureComplete(output);
  }
}