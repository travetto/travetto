import type { ModelType } from '@travetto/model';
import type { Class } from '@travetto/runtime';
import type { SchemaFieldConfig } from '@travetto/schema';

export type JSONSqlPathMode = 'orderBy' | 'createIndex' | 'read';

export interface SchemaContext<T> {
  cls: Class<T>;
  simpleFields: Map<string, SchemaFieldConfig>;
  complexFields: Map<string, SchemaFieldConfig>;
  allFields: SchemaFieldConfig[];
}

export interface TableContext<T extends ModelType> extends SchemaContext<T> {
  tableName: string;
}

/**
 * Result of query compilation
 */
export interface CompilationResult {
  whereSQL?: string;
  parameters?: unknown[];
}
