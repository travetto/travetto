import { ModelRegistryIndex } from '@travetto/model';
import { type Class, castTo, RuntimeError } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import type { SchemaContext } from './types.ts';

export class SQLModelUtil {
  static SCHEMA_CACHE = new Map<Class, SchemaContext<unknown>>();

  static getSchemaContext<T>(cls: Class<T>): SchemaContext<T> {
    if (this.SCHEMA_CACHE.has(cls)) {
      return castTo(this.SCHEMA_CACHE.get(cls)!);
    }

    const registryConfig = SchemaRegistryIndex.getOptional(cls)?.get();
    if (!registryConfig) {
      throw new RuntimeError('Cannot store unregistered models', { category: 'data' });
    }

    const fields = Object.values(registryConfig.fields).map(field => ({ ...field }));

    const hasModel = ModelRegistryIndex.has(cls);
    if (hasModel && registryConfig.discriminatedBase) {
      const fieldMap = new Set(fields.map(field => field.name));
      for (const subclass of SchemaRegistryIndex.getDiscriminatedClasses(cls)) {
        const subclassConfig = SchemaRegistryIndex.getConfig(subclass);
        for (const field of Object.values<SchemaFieldConfig>(subclassConfig.fields)) {
          if (!fieldMap.has(field.name)) {
            fieldMap.add(field.name);
            fields.push({ ...field, required: { active: false } });
          }
        }
      }
    }

    const simpleFieldsList = fields.filter(field => !SchemaRegistryIndex.has(field.type) && !field.array);
    const complexFieldsList = fields.filter(field => SchemaRegistryIndex.has(field.type) || field.array);
    const simpleFields = new Map(simpleFieldsList.map(field => [field.name, field]));
    const complexFields = new Map(complexFieldsList.map(field => [field.name, field]));
    const context: SchemaContext<T> = { cls, simpleFields, complexFields, allFields: fields };
    this.SCHEMA_CACHE.set(cls, context);
    return context;
  }
}
