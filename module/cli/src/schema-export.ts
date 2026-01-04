import { Class, describeFunction } from '@travetto/runtime';
import { SchemaInputConfig, SchemaRegistryIndex } from '@travetto/schema';

import { CliCommandRegistryIndex } from '../src/registry/registry-index.ts';

/**
 * CLI Command argument/flag shape
 */
export type CliCommandInput<K extends string = string> = {
  name: string;
  description?: string;
  type: 'string' | 'file' | 'number' | 'boolean' | 'date' | 'regex' | 'module';
  fileExtensions?: string[];
  choices?: unknown[];
  required?: boolean;
  array?: boolean;
  default?: unknown;
  flagNames?: K[];
  envVars?: string[];
};

/**
 * CLI Command schema shape
 */
export interface CliCommandSchema<K extends string = string> {
  name: string;
  module: string;
  runTarget?: boolean;
  description?: string;
  args: CliCommandInput[];
  flags: CliCommandInput<K>[];
}

export class CliSchemaExportUtil {

  /**
   * Get the base type for a CLI command input
   */
  static baseInputType(config: SchemaInputConfig): Pick<CliCommandInput, 'type' | 'fileExtensions'> {
    switch (config.type) {
      case Date: return { type: 'date' };
      case Boolean: return { type: 'boolean' };
      case Number: return { type: 'number' };
      case RegExp: return { type: 'regex' };
      case String: {
        switch (true) {
          case config.specifiers?.includes('module'): return { type: 'module' };
          case config.specifiers?.includes('file'): return {
            type: 'file',
            fileExtensions: config.specifiers?.map(specifier => specifier.split('ext:')[1]).filter(specifier => !!specifier)
          };
        }
      }
    }
    return { type: 'string' };
  }

  /**
   * Process input configuration for CLI commands
   */
  static processInput(config: SchemaInputConfig): CliCommandInput {
    return {
      ...this.baseInputType(config),
      ...(('name' in config && typeof config.name === 'string') ? { name: config.name } : { name: '' }),
      description: config.description,
      array: config.array,
      required: config.required?.active !== false,
      choices: config.enum?.values,
      default: Array.isArray(config.default) ? config.default.slice(0) : config.default,
      flagNames: (config.aliases ?? []).slice(0).filter(value => !value.startsWith('env.')),
      envVars: (config.aliases ?? []).slice(0).filter(value => value.startsWith('env.')).map(value => value.replace('env.', ''))
    };
  }

  static exportSchema(cls: Class): CliCommandSchema {
    const schema = SchemaRegistryIndex.getConfig(cls);
    const config = CliCommandRegistryIndex.get(cls);
    const processed = Object.values(schema.fields).map(value => this.processInput(value));
    return {
      name: config.name,
      module: describeFunction(config.cls).module,
      description: schema.description,
      flags: processed.filter(value => value.flagNames && value.flagNames.length > 0),
      args: processed.filter(value => !value.flagNames || value.flagNames.length === 0),
      runTarget: config.runTarget ?? false
    };
  }
}