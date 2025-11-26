import { describeFunction, Env } from '@travetto/runtime';
import { IsPrivate } from '@travetto/schema';

import { CliCommand } from '../src/registry/decorator.ts';
import { CliCommandShape, CliValidationError } from '../src/types.ts';
import { CliCommandRegistryIndex } from '../src/registry/registry-index.ts';
import { CliUtil } from '../src/util.ts';

// /**
//  * Get the base type for a CLI command input
//  */
// static baseInputType(x: SchemaInputConfig): Pick<CliCommandInput, 'type' | 'fileExtensions'> {
//   switch (x.type) {
//     case Date: return { type: 'date' };
//     case Boolean: return { type: 'boolean' };
//     case Number: return { type: 'number' };
//     case RegExp: return { type: 'regex' };
//     case String: {
//       switch (true) {
//         case x.specifiers?.includes('module'): return { type: 'module' };
//         case x.specifiers?.includes('file'): return {
//           type: 'file',
//           fileExtensions: x.specifiers?.map(s => s.split('ext:')[1]).filter(s => !!s)
//         };
//       }
//     }
//   }
//   return { type: 'string' };
// }

// /**
//  * Process input configuration for CLI commands
//  */
// static processInput(x: SchemaInputConfig): CliCommandInput {
//   return {
//     ...CliCommandRegistryUtil.baseInputType(x),
//     ...(('name' in x && typeof x.name === 'string') ? { name: x.name } : { name: '' }),
//     description: x.description,
//     array: x.array,
//     required: x.required?.active !== false,
//     choices: x.enum?.values,
//     default: Array.isArray(x.default) ? x.default.slice(0) : x.default,
//     flagNames: (x.aliases ?? []).slice(0).filter(v => !v.startsWith('env.')),
//     envVars: (x.aliases ?? []).slice(0).filter(v => v.startsWith('env.')).map(v => v.replace('env.', ''))
//   };
// }

/**
 * Generates the schema for all CLI operations
 */
@CliCommand()
@IsPrivate()
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
      .map(x => {
        const { schema, config } = x;
        return {
          name: config.name,
          module: describeFunction(config.cls).module,
          description: schema.title || schema.description,
          // TODO: Create output schema for all fields
          fields: Object.entries(schema.fields).map(([k, v]) => ({
            // name: k,
            ...v
          }))
        };
      })
    await CliUtil.writeAndEnsureComplete(output);
  }
}