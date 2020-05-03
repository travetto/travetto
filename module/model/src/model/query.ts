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
  offset?: number;
};

type QueryMain<T> = {
  select?: SelectClauseRaw<T>;
  where?: WhereClauseRaw<T>;
  // TODO: Add grouping in later
  // group?: GroupClauseRaw<T>;
};

type QueryRaw<T> = QueryMain<T> & QueryOptionsRaw<T>;
type ModelQueryRaw<T> = { where?: WhereClauseRaw<T> };
type PageableModelQueryRaw<T> = ModelQueryRaw<T> & QueryOptionsRaw<T>;
type PageableModelQueryStringQueryRaw<T> = QueryOptionsRaw<T> & { query: string };

export type Query<T> = QueryRaw<RetainFields<T>>;
export type PageableModelQuery<T> = PageableModelQueryRaw<RetainFields<T>>;
export type QueryOptions<T> = QueryOptionsRaw<RetainFields<T>>;
export type SelectClause<T> = SelectClauseRaw<RetainFields<T>>;
export type SortClause<T> = SortClauseRaw<RetainFields<T>>;
export type GroupClause<T> = GroupClauseRaw<RetainFields<T>>;
export type ModelQuery<T> = ModelQueryRaw<RetainFields<T>>;
export type PageableModelQueryStringQuery<T> = PageableModelQueryStringQueryRaw<RetainFields<T>>;