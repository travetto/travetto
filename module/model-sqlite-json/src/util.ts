import { ModelRegistryIndex, type ModelType } from '@travetto/model';
import { type Class, castTo, RuntimeError } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

export interface SchemaContext<T> {
  modelClass: Class<T>;
  simpleFields: Map<string, SchemaFieldConfig>;
  complexFields: Map<string, SchemaFieldConfig>;
  allFields: SchemaFieldConfig[];
}

/**
 * Compilation context containing metadata and parameters
 */
export interface TableContext<T extends ModelType> extends SchemaContext<T> {
  tableName: string;
}

/**
 * Utility helpers for SQLite JSON model schema mapping
 */
export class SqliteJsonUtil {
  static SCHEMA_CACHE = new Map<Class, SchemaContext<unknown>>();

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
    const context: SchemaContext<T> = { modelClass, simpleFields, complexFields, allFields: fields };
    this.SCHEMA_CACHE.set(modelClass, context);
    return context;
  }

  static getContext<T extends ModelType>(modelClass: Class<T>, namespace?: string): TableContext<T> {
    let tableName = ModelRegistryIndex.getStoreName(modelClass);
    if (namespace) {
      tableName = `${namespace}_${tableName}`;
    }

    return { tableName, ...this.getSchemaContext(modelClass) };
  }

  /**
   * Maps a schema field config to its corresponding SQLite data type
   */
  static getColumnType(fieldConfiguration: SchemaFieldConfig): string {
    if (SchemaRegistryIndex.has(fieldConfiguration.type) || fieldConfiguration.array) {
      return 'TEXT';
    }

    if (fieldConfiguration.type === castTo(BigInt)) {
      return 'INTEGER';
    }

    if (fieldConfiguration.type === Number) {
      if (fieldConfiguration.precision) {
        const [_digits, decimals] = fieldConfiguration.precision;
        if (decimals) {
          return 'REAL';
        }
        return 'INTEGER';
      }
      return 'INTEGER';
    }

    if (fieldConfiguration.type === Date) {
      return 'INTEGER';
    }

    if (fieldConfiguration.type === Boolean) {
      return 'INTEGER';
    }

    if (fieldConfiguration.type === String) {
      return 'TEXT';
    }

    return 'TEXT';
  }

  /**
   * Escapes a SQL identifier (like table or column names) by wrapping in double quotes and doubling existing double quotes.
   */
  static escapeIdentifier(name: string): string {
    return `"${name.replaceAll('"', '""')}"`;
  }

  /**
   * Escapes a SQL literal string (like string constants or JSON path segments) by doubling single quotes.
   */
  static escapeLiteral(value: string): string {
    return value.replaceAll("'", "''");
  }
}
