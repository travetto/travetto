export type GroupByField<T> = {
  [P in keyof T]: 1 | true | GroupByField<T[P]>
};

export type GroupByClause<T> = GroupByField<T>;