import { Class } from '@travetto/registry';
import { WhereClause } from './where';

type SelectFieldFn = 'max' | 'min' | 'avg' | 'sum' | 'count';

type SelectClause<T> = {
  [P in keyof T]?: string | 1 | true | ({ alias: string, calc: SelectFieldFn }) | object
};

type GroupClause<T> = {
  [P in keyof T]?: 1 | true | object
};

export type SortClause<T> = {
  [P in keyof T]?: boolean | 1 | -1 | object;
}

export interface QueryOptions<T> {
  sort?: SortClause<T>[];
  limit?: number;
  offset?: number;
}

type QueryMain<T> =
  {
    select: SelectClause<T>;
    where?: WhereClause<T>;
    group: GroupClause<T>;
  } | {
    select?: SelectClause<T>;
    where: WhereClause<T>;
  }

export type Query<T> = QueryMain<T> & QueryOptions<T>;
export type ModelQuery<T> = { where?: WhereClause<T> };
export type PageableModelQuery<T> = ModelQuery<T> & QueryOptions<T>