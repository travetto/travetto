import { ChangeEvent, RegistryIndex } from '@travetto/registry';
import { Class } from '@travetto/runtime';

import { FieldConfig, ClassConfig, MethodConfig } from './types.ts';
import { SchemaAdapter } from './registry-adapter.ts';

/**
 * Schema registry index for managing schema configurations across classes
 */
export class SchemaRegistryIndex implements RegistryIndex<ClassConfig, MethodConfig, FieldConfig> {

  process(events: ChangeEvent<Class>): void {
    throw new Error('Method not implemented.');
  }

  adapter(cls: Class): SchemaAdapter {
    return new SchemaAdapter(cls);
  }
}