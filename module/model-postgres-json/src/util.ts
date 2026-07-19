import { ModelRegistryIndex, type ModelType } from '@travetto/model';
import { type Class, castTo, RuntimeError } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

export interface SchemaContext<T> {
  cls: Class<T>;
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
 * Utility helpers for PostgreSQL JSON model schema mapping
 */
export class PostgresJsonUtil {
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

  static getContext<T extends ModelType>(modelClass: Class<T>, namespace?: string): TableContext<T> {
    let tableName = ModelRegistryIndex.getStoreName(modelClass);
    if (namespace) {
      tableName = `${namespace}_${tableName}`;
    }

    return { tableName, ...this.getSchemaContext(modelClass) };
  }

  /**
   * Maps a schema field config to its corresponding PostgreSQL data type
   */
  static getColumnType(fieldConfiguration: SchemaFieldConfig): string {
    if (SchemaRegistryIndex.has(fieldConfiguration.type) || fieldConfiguration.array) {
      return 'JSONB';
    }

    if (fieldConfiguration.type === castTo(BigInt)) {
      return 'BIGINT';
    }

    if (fieldConfiguration.type === Number) {
      if (fieldConfiguration.precision) {
        const [digits, decimals] = fieldConfiguration.precision;
        if (decimals) {
          return `DECIMAL(${digits},${decimals})`;
        }
        if (digits < 5) {
          return 'SMALLINT';
        }
        if (digits < 10) {
          return 'INTEGER';
        }
        return 'BIGINT';
      }
      return 'INTEGER';
    }

    if (fieldConfiguration.type === Date) {
      return 'TIMESTAMP(6) WITH TIME ZONE';
    }

    if (fieldConfiguration.type === Boolean) {
      return 'BOOLEAN';
    }

    if (fieldConfiguration.type === String) {
      if (fieldConfiguration.specifiers?.includes('text')) {
        return 'TEXT';
      }
      return `VARCHAR(${fieldConfiguration.maxlength?.limit ?? 1024})`;
    }

    return 'JSONB';
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
