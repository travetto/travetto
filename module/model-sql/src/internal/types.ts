import type { SchemaFieldConfig, SchemaClassConfig } from '@travetto/schema';

import type { VisitStack } from '../types.ts';

/**
 * Insertion wrapper
 */
export interface InsertWrapper {
  stack: VisitStack[];
  records: { stack: VisitStack[], value: unknown }[];
}

/**
 * Dialect wrapper
 */
export interface DeleteWrapper {
  stack: VisitStack[];
  ids: string[];
}

/**
 * Dialect state
 */
export interface DialectState {
  pathField: SchemaFieldConfig;
  parentPathField: SchemaFieldConfig;
  idField: SchemaFieldConfig;
  idxField: SchemaFieldConfig;
}

export type VisitState = { path: VisitStack[] };

/**
 * Visited node
 */
export interface VisitNode<R> {
  path: VisitStack[];
  fields: SchemaFieldConfig[];
  descend: () => R;
}

/**
 * Order by state
 */
export interface OrderBy {
  stack: VisitStack[];
  asc: boolean;
}

/**
 * Visitation instance
 */
export interface VisitInstanceNode<R> extends VisitNode<R> {
  value: unknown;
}

/**
 * Visit handler
 */
export interface VisitHandler<R, U extends VisitNode<R> = VisitNode<R>> {
  onRoot(config: U & { config: SchemaClassConfig }): R;
  onSub(config: U & { config: SchemaFieldConfig }): R;
  onSimple(config: Omit<U, 'descend'> & { config: SchemaFieldConfig }): R;
}
