import { FieldConfig, ClassConfig } from '@travetto/schema';
import { VisitStack } from './util';

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
  pathField: FieldConfig;
  parentPathField: FieldConfig;
  idField: FieldConfig;
  idxField: FieldConfig;
}

export type VisitState = { path: VisitStack[] };

/**
 * Visited node
 */
export interface VisitNode<R> {
  path: VisitStack[];
  fields: FieldConfig[];
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
  onRoot(config: U & { config: ClassConfig }): R;
  onSub(config: U & { config: FieldConfig }): R;
  onSimple(config: Omit<U, 'descend'> & { config: FieldConfig }): R;
}
