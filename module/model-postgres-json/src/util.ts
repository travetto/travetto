import { ModelRegistryIndex, type ModelType } from '@travetto/model';
import type { SortClause, WhereClause } from '@travetto/model-query';
import { type Class, castTo } from '@travetto/runtime';
import { type SchemaFieldConfig, SchemaRegistryIndex } from '@travetto/schema';

import { PostgresJsonQueryCompiler } from './query.ts';
import { PostgresJsonTableManager } from './table-manager.ts';

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

  /**
   * Compiles the where clause of a query and returns the compiled SQL, parameter values, and compiler instance.
   */
  static compileWhere<T extends ModelType>(
    modelClass: Class<T>,
    where?: WhereClause<T>
  ): { whereSQL: string; parameters: unknown[]; compiler: PostgresJsonQueryCompiler } {
    const tableName = PostgresJsonTableManager.getTableName(modelClass);
    const classification = PostgresJsonUtil.classifyFields(modelClass);
    const simpleFieldsSet = new Set(classification.simpleFields.map(field => field.name));
    const compiler = new PostgresJsonQueryCompiler(modelClass, tableName, simpleFieldsSet);
    const result = compiler.compile(castTo(where));
    return {
      whereSQL: result.whereSQL,
      parameters: result.parameters,
      compiler
    };
  }

  /**
   * Compiles the sort clauses of a query and returns the compiled SQL.
   */
  static compileSort<T extends ModelType>(compiler: PostgresJsonQueryCompiler, sort?: SortClause<T>[]): string {
    if (!sort || sort.length === 0) {
      return '';
    }
    const sortClauses = sort.map(sortClause => {
      const key = Object.keys(sortClause)[0];
      const direction = castTo<any>(sortClause)[key];
      const path = key.split('.');
      const { sqlPath } = compiler.resolvePath(path);
      return `${sqlPath} ${direction === -1 ? 'DESC' : 'ASC'}`;
    });
    return sortClauses.length ? `ORDER BY ${sortClauses.join(', ')}` : '';
  }
}
