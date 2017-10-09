type SelectFieldFn = 'max' | 'min' | 'avg' | 'sum' | 'count';

export type SelectField<T> = {
  [P in keyof T]: string | 1 | true | ({ alias: string, calc: SelectFieldFn }) | SelectField<T[P]>
};

export type SelectClause<T> = '*' | SelectField<T>;
