import { ModelRegistryIndex } from '@travetto/model';
import type { Class } from '@travetto/runtime';
import { castTo, RuntimeError, TypedObject } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { SchemaContext } from './types';

export class SQLModelSchemaUtil {
  static SCHEMA_CACHE = new Map<Class, SchemaContext<unknown>>();

  // Schema and Context management
  static getSchemaContext<T>(modelClass: Class<T>): SchemaContext<T> {
    if (this.SCHEMA_CACHE.has(modelClass)) {
      return castTo(this.SCHEMA_CACHE.get(modelClass)!);
    }

    const registryConfig = SchemaRegistryIndex.getOptional(modelClass)?.get();
    if (!registryConfig) {
      throw new RuntimeError('Cannot store unregistered models', { category: 'data' });
    }

    const fields = Object.values(registryConfig.fields).map(field => ({ ...field }));

    const hasModel = ModelRegistryIndex.has(modelClass);
    if (hasModel && registryConfig.discriminatedBase) {
      const fieldMap = new Set(fields.map(field => field.name));
      for (const subclass of SchemaRegistryIndex.getDiscriminatedClasses(modelClass)) {
        const subclassConfig = SchemaRegistryIndex.getConfig(subclass);
        for (const field of TypedObject.values(subclassConfig.fields)) {
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
    const context: SchemaContext<T> = { cls: modelClass, simpleFields, complexFields, allFields: fields };
    this.SCHEMA_CACHE.set(modelClass, context);
    return context;
  }
}
