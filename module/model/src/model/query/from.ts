import { Class } from '@travetto/registry';
import { SelectClause } from './select';
import { WhereClause } from './where';
import { GroupByClause } from './groupBy';

export interface Query<T> {
  select: SelectClause<T>;
  where?: WhereClause<T>;
  groupBy?: GroupByClause<T>;
}