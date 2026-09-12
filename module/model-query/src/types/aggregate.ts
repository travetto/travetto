import type { ModelType } from '@travetto/model';
import type { Class } from '@travetto/runtime';

import type { ModelQuery } from '../model/query.ts';
import type { ValidComparableFields } from '../model/where-clause.ts';
import type { ModelQuerySupport } from './query.ts';

export type PathType<T, Path extends string> = Path extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? PathType<NonNullable<T[Head]> extends (infer Element)[] ? Element : NonNullable<T[Head]>, Tail>
    : never
  : Path extends keyof T
    ? NonNullable<T[Path]> extends (infer Element)[]
      ? Element
      : NonNullable<T[Path]>
    : never;

export type AggregateResultType<T, F extends string> = [PathType<T, F>] extends [never]
  ? number | Date | bigint | undefined
  : PathType<T, F> | undefined;

export type DateFieldAggregateResult = {
  count: number;
  min?: Date;
  max?: Date;
};

export type NumericFieldAggregateResult<T, F extends string> = {
  count: number;
  min?: AggregateResultType<T, F>;
  max?: AggregateResultType<T, F>;
  avg?: AggregateResultType<T, F>;
  sum?: AggregateResultType<T, F>;
};

export type FieldAggregateResult<T, F extends string> =
  NonNullable<PathType<T, F>> extends Date ? DateFieldAggregateResult : NumericFieldAggregateResult<T, F>;

/**
 * The contract for a model service with aggregate support
 * @concrete
 */
export interface ModelQueryAggregateSupport extends ModelQuerySupport {
  /**
   * Run an aggregation on a comparable field.
   * For numeric fields (number/bigint), returns count, min, max, avg, and sum.
   * For date fields, returns count, min, and max.
   * @param modelClass The model class to aggregate
   * @param field The field to aggregate on
   * @param query Additional query filtering
   */
  aggregateFieldByQuery<T extends ModelType, F extends ValidComparableFields<T>>(
    modelClass: Class<T>,
    field: F,
    query?: ModelQuery<T>
  ): Promise<FieldAggregateResult<T, F>>;
}
