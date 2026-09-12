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
  ? number | bigint | undefined
  : PathType<T, F> | undefined;

export type DateFieldAggregateResult = {
  count: number;
  min?: Date;
  max?: Date;
};

export type NumberFieldAggregateResult = {
  count: number;
  min?: number;
  max?: number;
  avg?: number;
  sum?: number;
};

export type BigIntFieldAggregateResult = {
  count: number;
  min?: bigint;
  max?: bigint;
  avg?: bigint;
  sum?: bigint;
};

export type FieldAggregateResult<T, F extends string> = F extends any
  ? NonNullable<PathType<T, F>> extends Date
    ? DateFieldAggregateResult
    : NonNullable<PathType<T, F>> extends bigint
      ? BigIntFieldAggregateResult
      : NumberFieldAggregateResult
  : never;

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
  aggregateFieldByQuery<T extends ModelType, const F extends ValidComparableFields<T>>(
    modelClass: Class<T>,
    field: F,
    query?: ModelQuery<T>
  ): Promise<FieldAggregateResult<T, F>>;
}
