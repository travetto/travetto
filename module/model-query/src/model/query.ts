import { WhereClauseRaw, RetainFields } from './where-clause';

type SelectClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? SelectClauseRaw<RetainFields<T[P]>> : (1 | 0 | boolean);
};

type GroupClauseRaw<T> = {
  [P in keyof T]?: T[P] extends object ? GroupClauseRaw<RetainFields<T[P]>> : (1 | 0 | boolean);
};

type SortClauseRaw<T> = {
  [P in keyof T]?:
  T[P] extends object ? SortClauseRaw<RetainFields<T[P]>> : (1 | -1 | boolean);
};

type QueryOptionsRaw<T> = {
  sort?: SortClauseRaw<T>[];
  limit?: number;
  offset?: number | string;
};

type QueryMain<T> = {
  select?: SelectClauseRaw<T>;
  where?: WhereClauseRaw<T> | string;
  // TODO: Add grouping in later
  // group?: GroupClauseRaw<T>;
};

type QueryRaw<T> = QueryMain<T> & QueryOptionsRaw<T>;
type ModelQueryRaw<T> = QueryMain<T>;
type PageableModelQueryRaw<T> = ModelQueryRaw<T> & QueryOptionsRaw<T>;

/**
 * Type of a full query
 */
export type Query<T> = QueryRaw<RetainFields<T>>;
/**
 * Query with support for pagination (limit, offset)
 */
export type PageableModelQuery<T> = PageableModelQueryRaw<RetainFields<T>>;
/**
 * Standard query options (limit, offset)
 */
export type QueryOptions<T> = QueryOptionsRaw<RetainFields<T>>;
/**
 * Select clause
 */
export type SelectClause<T> = SelectClauseRaw<RetainFields<T>>;
/**
 * Sort clause
 */
export type SortClause<T> = SortClauseRaw<RetainFields<T>>;
/**
 * Group clause
 */
export type GroupClause<T> = GroupClauseRaw<RetainFields<T>>;
/**
 * Model query, requiring a model object
 */
export type ModelQuery<T> = ModelQueryRaw<RetainFields<T>>;