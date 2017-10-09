import { Class } from '@travetto/registry';
import { SelectClause } from './select';
import { WhereQuery } from './where';

type GroupByClause<T> = T;

export interface Query<T> {
  select: SelectClause<T>;
  where: WhereQuery<T>;
  groupBy: GroupByClause<T>;
}