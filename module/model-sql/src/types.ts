import { FieldConfig, SchemaChangeEvent } from '@travetto/schema';
import { Class } from '@travetto/registry';
import { Query, BulkResponse } from '@travetto/model';

import { ConnectionSupport } from './dialect/connection';
import { VisitStack } from './util';
import { WhereClause } from '@travetto/model/src/model/where-clause';
import { SelectClause } from '@travetto/model/src/model/query';

export interface InsertWrapper {
  stack: VisitStack[];
  records: { stack: VisitStack[], value: any }[];
}

export interface DeleteWrapper {
  stack: VisitStack[];
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
  getDeleteByIdsSQL(stack: VisitStack[], ids: string[]): string;
  getSelectRowsByIdsSQL<T>(stack: VisitStack[], ids: string[], select?: FieldConfig[]): string;
  getUpdateSQL(stack: VisitStack[], data: any, where?: WhereClause<any>): string;
  getDeleteSQL(stack: VisitStack[], where?: WhereClause<any>): string;
  getDeleteByIdsSQL(stack: VisitStack[], ids: string[]): string;
  getSelectRowsByIdsSQL<T>(stack: VisitStack[], ids: string[], select?: FieldConfig[]): string;
  getQueryCountSQL<T>(cls: Class<T>, query: Query<T>): string;
  fetchDependents<T>(cls: Class<T>, items: T[], select?: SelectClause<T>): Promise<T[]>;

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