import { FieldConfig, SchemaChangeEvent } from '@travetto/schema';
import { Class } from '@travetto/registry';
import { Query, BulkResponse } from '@travetto/model';

import { ConnectionSupport } from './dialect/connection';
import { VisitStack } from './util';

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
  parentPathField: FieldConfig;
  pathField: FieldConfig;
  idField: FieldConfig;
  idxField: FieldConfig;

  conn: ConnectionSupport;

  generateId(): string;
  handleFieldChange?(ev: SchemaChangeEvent): Promise<void>;

  // Schema support
  hash(name: string): string;
  getColumnDefinition(config: FieldConfig): string;
  resolveValue(field: FieldConfig, value: any): string;
  namespace(name: string | VisitStack[]): string;

  // SQL Generation
  getCreateTableSQL(stack: VisitStack[]): string;
  getDropTableSQL(stack: VisitStack[]): string;
  getQuerySQL<T>(cls: Class<T>, query: Query<T>): string;
  getInsertSQL(stack: VisitStack[], instances: any[], idxOffset?: number): string;
  getUpdateSQL(stack: VisitStack[], data: any, suffix?: string): string;
  getDeleteByIdsSQL(stack: VisitStack[], ids: string[]): string;
  getSelectRowsByIdsSQL<T>(cls: Class<T>, stack: VisitStack[], ids: string[], select?: FieldConfig[]): string;

  executeSQL<T>(sql: string): Promise<T>;

  deleteAndGetCount<T>(cls: Class<T>, query: Query<T>): Promise<number>;
  getCountForQuery<T>(cls: Class<T>, query: Query<T>): Promise<number>;

  bulkProcess?(
    dels: DeleteWrapper[],
    inserts: InsertWrapper[],
    upserts: InsertWrapper[],
    updates: InsertWrapper[]
  ): Promise<BulkResponse>;
}