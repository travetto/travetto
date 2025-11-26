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
  title: string;
  module: string;
  commandModule: string;
  runTarget?: boolean;
  description?: string;
  args: CliCommandInput[];
  flags: CliCommandInput<K>[];
}

export class CliSchemaExportUtil {

  /**
    * Get the base type for a CLI command input
    */
  static baseInputType(x: SchemaInputConfig): Pick<CliCommandInput, 'type' | 'fileExtensions'> {
    switch (x.type) {
      case Date: return { type: 'date' };
      case Boolean: return { type: 'boolean' };
      case Number: return { type: 'number' };
      case RegExp: return { type: 'regex' };
      case String: {
        switch (true) {
          case x.specifiers?.includes('module'): return { type: 'module' };
          case x.specifiers?.includes('file'): return {
            type: 'file',
            fileExtensions: x.specifiers?.map(s => s.split('ext:')[1]).filter(s => !!s)
          };
        }
      }
    }
    return { type: 'string' };
  }

  /**
   * Process input configuration for CLI commands
   */
  static processInput(x: SchemaInputConfig): CliCommandInput {
    return {
      ...this.baseInputType(x),
      ...(('name' in x && typeof x.name === 'string') ? { name: x.name } : { name: '' }),
      description: x.description,
      array: x.array,
      required: x.required?.active !== false,
      choices: x.enum?.values,
      default: Array.isArray(x.default) ? x.default.slice(0) : x.default,
      flagNames: (x.aliases ?? []).slice(0).filter(v => !v.startsWith('env.')),
      envVars: (x.aliases ?? []).slice(0).filter(v => v.startsWith('env.')).map(v => v.replace('env.', ''))
    };
  }

  static exportSchema(cls: Class): CliCommandSchema {
    const schema = SchemaRegistryIndex.getConfig(cls);
    const config = CliCommandRegistryIndex.get(cls);
    const processed = Object.values(schema.fields).map(v => this.processInput(v));
    return {
      name: config.name,
      module: describeFunction(config.cls).module,
      description: schema.title || schema.description,
      flags: processed.filter(v => v.flagNames && v.flagNames.length > 0),
      args: processed.filter(v => !v.flagNames || v.flagNames.length === 0),
      runTarget: config.runTarget ?? false,
      commandModule: describeFunction(cls).module,
      title: schema.title || schema.description || ''
    };
  }
}