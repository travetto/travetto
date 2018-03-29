import { Class } from '@travetto/registry';
import { WhereClause } from './where';
import { RetainFields } from './common';

type SelectFieldFn = 'max' | 'min' | 'avg' | 'sum' | 'count';

type _SelectClause<T> = {
  [P in keyof T]?: T[P] extends { alias: string, calc: SelectFieldFn } | 1 | 0 | boolean ? T[P] : _SelectClause<T[P]>;
};

type _GroupClause<T> = {
  [P in keyof T]?: T[P] extends object ? _GroupClause<T[P]> : (1 | 0 | boolean)
};

type _SortClause<T> = {
  [P in keyof T]?: T[P] extends object ? _SortClause<T[P]> : (boolean | 1 | -1);
}

type _QueryOptions<T> = {
  sort?: _SortClause<T>[];
  limit?: number;
  offset?: number;
}

type _QueryMain<T> = {
  select?: _SelectClause<T>;
  where?: WhereClause<T>;
  group?: _GroupClause<T>;
}

type _Query<T> = _QueryMain<T> & _QueryOptions<T>;
type _ModelQuery<T> = { where?: WhereClause<T> }
type _PageableModelQuery<T> = _ModelQuery<T> & _QueryOptions<T>

export type Query<T> = _Query<RetainFields<T>>;
export type PageableModelQuery<T> = _PageableModelQuery<RetainFields<T>>;
export type QueryOptions<T> = _QueryOptions<RetainFields<T>>;
export type SelectClause<T> = _SelectClause<RetainFields<T>>;
export type SortClause<T> = _SortClause<RetainFields<T>>;
export type GroupClause<T> = _GroupClause<RetainFields<T>>;
export type ModelQuery<T> = _ModelQuery<RetainFields<T>>;