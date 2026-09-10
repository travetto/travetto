import type { Class } from '@travetto/runtime';

import { SchemaRegistryIndex } from './service/registry-index.ts';
import type { SchemaFieldConfig } from './service/types.ts';

/**
 * Utility functions for navigating and operating on schemas
 */
export class SchemaUtil {
  /**
   * Resolve a dotted field path to the specific leaf SchemaFieldConfig
   * @param modelClass The root class
   * @param field The field path (either dotted string or array of segments)
   */
  static getFieldConfig(modelClass: Class, field: string | string[]): SchemaFieldConfig | undefined {
    if (!SchemaRegistryIndex.has(modelClass)) {
      return undefined;
    }
    const segments = Array.isArray(field) ? field : String(field).split('.');
    let currentClass: Class | undefined = modelClass;
    let fieldConfiguration: SchemaFieldConfig | undefined;

    for (const segment of segments) {
      if (!currentClass || !SchemaRegistryIndex.has(currentClass)) {
        return undefined;
      }
      fieldConfiguration = SchemaRegistryIndex.getConfig(currentClass).fields[segment];
      currentClass = fieldConfiguration?.type;
    }

    return fieldConfiguration;
  }
}
