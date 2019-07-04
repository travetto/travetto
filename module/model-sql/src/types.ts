import { FieldConfig } from '@travetto/schema';
import { Class } from '@travetto/registry';
import { Query, BulkResponse } from '@travetto/model';

import { ConnectionSupport } from './dialect/connection';

export interface InsertWrapper {
  table: string;
  level: number;
  fields: string[];
  records: any[][];
}

export interface DeleteWrapper {
  table: string;
  level?: number;
  ids: string[];
}

export interface Dialect {
  ROOT: string;

  parentPathField: FieldConfig;
  pathField: FieldConfig;
  idField: FieldConfig;
  idxField: FieldConfig;

  conn: ConnectionSupport;

  sort(name: string, asc: boolean): string;

  // Schema support
  hash(name: string): string;
  getColumnDefinition(config: FieldConfig): string;
  resolveTable(cls: Class, prefix?: string, aliases?: Record<string, string>): string;
  resolveValue(field: FieldConfig, value: any): string;
  namespace(name: Class | string): string;

  // Basic table creation
  createTableSQL(name: string, fields: FieldConfig[], suffix?: string): string;
  dropTableSQL(name: string): string;

  // Basic querying
  executeSQL<T>(sql: string): Promise<T>;
  query<T, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]>;
  deleteAndGetCount<T>(cls: Class<T>, query: Query<T>): Promise<number>;
  getCountForQuery<T>(cls: Class<T>, query: Query<T>): Promise<number>;

  // Basic data management
  selectRowsByIds<T>(table: string, field: string, ids: string[], select?: string[], order?: { field: string, asc: boolean }[]): Promise<T[]>;
  bulkProcess(
    dels: DeleteWrapper[],
    inserts: InsertWrapper[],
    upserts: InsertWrapper[],
    updates: InsertWrapper[]
  ): Promise<BulkResponse>;
}