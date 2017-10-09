import { Class } from '@travetto/registry';
import { SelectClause } from './select';
import { WhereClause } from './where';

type GroupByClause<T> = T;

export interface Query<T> {
  select: SelectClause<T>;
  where: WhereClause<T>;
  groupBy: GroupByClause<T>;
}