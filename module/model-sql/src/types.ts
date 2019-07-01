import { ConnectionSupport } from './dialect/connection';
import { FieldConfig } from '@travetto/schema';
import { Class } from '@travetto/registry';
import { Query, BulkResponse } from '@travetto/model';

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
  PARENT_PATH_ID: string;
  PATH_ID: string;
  PATH_ID_LEN: number;
  PATH_KEY_TYPE: string;
  ROOT: string;
  ID_FIELD: string;

  conn: ConnectionSupport;

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
  selectRowsByIds<T>(table: string, field: string, ids: string[], select?: string): Promise<T[]>;
  bulkProcess(
    dels: DeleteWrapper[],
    inserts: InsertWrapper[],
    upserts: InsertWrapper[],
    updates: InsertWrapper[]
  ): Promise<BulkResponse>;
}