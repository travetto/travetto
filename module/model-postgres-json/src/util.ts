import { ModelRegistryIndex } from '@travetto/model';
import { type Class, castTo } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

export interface FieldClassification {
  simpleFields: SchemaFieldConfig[];
  complexFields: SchemaFieldConfig[];
  allFields: SchemaFieldConfig[];
}

/**
 * Utility helpers for PostgreSQL JSON model schema mapping
 */
export class PostgresJsonUtil {
  /**
   * Classifies schema fields of a class into simple (primitive columns) and complex (JSONB columns)
   */
  static classifyFields(modelClass: Class): FieldClassification {
    const registryConfig = SchemaRegistryIndex.getOptional(modelClass)?.get();
    if (!registryConfig) {
      return { simpleFields: [], complexFields: [], allFields: [] };
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

    // Ensure the standard 'id' field is present in our list
    if (!fields.some(field => field.name === 'id')) {
      fields.push({
        name: 'id',
        class: modelClass,
        type: String,
        array: false,
        required: { active: true }
      });
    }

    // Ensure polymorphic 'type' field is present for discriminated classes
    if (registryConfig.discriminatedBase && !fields.some(field => field.name === 'type')) {
      fields.push({
        name: 'type',
        class: modelClass,
        type: String,
        array: false,
        required: { active: true }
      });
    }

    const simpleFields = fields.filter(field => !SchemaRegistryIndex.has(field.type) && !field.array);
    const complexFields = fields.filter(field => SchemaRegistryIndex.has(field.type) || field.array);

    return {
      simpleFields,
      complexFields,
      allFields: fields
    };
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
}
