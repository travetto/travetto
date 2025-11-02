import { WhereClauseRaw, RetainQueryPrimitiveFields } from './where-clause.ts';

type SelectClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? SelectClauseRaw<RetainQueryPrimitiveFields<T[P]>> : (1 | 0 | boolean);
};

type GroupClauseRaw<T> = {
  [P in keyof T]?: T[P] extends object ? GroupClauseRaw<RetainQueryPrimitiveFields<T[P]>> : (1 | 0 | boolean);
};

type SortClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? SortClauseRaw<RetainQueryPrimitiveFields<T[P]>> : 1 | -1;
};

type QueryOptionsRaw<T> = {
  sort?: SortClauseRaw<T>[];
  limit?: number;
  offset?: number | string;
};

type QueryMain<T> = {
  select?: SelectClauseRaw<T>;
  where?: WhereClauseRaw<T>;
  // TODO: Add grouping in later
  // group?: GroupClauseRaw<T>;
};

type QueryRaw<T> = QueryMain<T> & QueryOptionsRaw<T>;
type ModelQueryRaw<T> = QueryMain<T>;
type PageableModelQueryRaw<T> = ModelQueryRaw<T> & QueryOptionsRaw<T>;

/**
 * Type of a full query
 */
export type Query<T> = QueryRaw<RetainQueryPrimitiveFields<T>>;
/**
 * Query with support for pagination (limit, offset)
 */
export type PageableModelQuery<T> = PageableModelQueryRaw<RetainQueryPrimitiveFields<T>>;
/**
 * Standard query options (limit, offset)
 */
export type QueryOptions<T> = QueryOptionsRaw<RetainQueryPrimitiveFields<T>>;
/**
 * Select clause
 */
export type SelectClause<T> = SelectClauseRaw<RetainQueryPrimitiveFields<T>>;
/**
 * Sort clause
 */
export type SortClause<T> = SortClauseRaw<RetainQueryPrimitiveFields<T>>;
/**
 * Group clause
 */
export type GroupClause<T> = GroupClauseRaw<RetainQueryPrimitiveFields<T>>;
/**
 * Model query, requiring a model object
 */
export type ModelQuery<T> = ModelQueryRaw<RetainQueryPrimitiveFields<T>>;