import type { ModelType } from '@travetto/model';
import type { Class } from '@travetto/runtime';

import type { ModelQuery } from '../model/query.ts';
import type { ValidComparableFields, ValidNumericFields } from '../model/where-clause.ts';
import type { ModelQuerySupport } from './query.ts';

export type AggregateNumericOperation = 'sum' | 'avg';
export type AggregateComparableOperation = 'min' | 'max';
export type AggregateOperation = AggregateNumericOperation | AggregateComparableOperation;

export type PathType<T, Path extends string> = Path extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? PathType<NonNullable<T[Head]> extends (infer Element)[] ? Element : NonNullable<T[Head]>, Tail>
    : never
  : Path extends keyof T
    ? NonNullable<T[Path]> extends (infer Element)[]
      ? Element
      : NonNullable<T[Path]>
    : never;

export type AggregateResultType<T, Op extends AggregateOperation, F extends string> = [PathType<T, F>] extends [never]
  ? number | Date | bigint | undefined
  : PathType<T, F> | undefined;

/**
 * The contract for a model service with aggregate support
 * @concrete
 */
export interface ModelQueryAggregateSupport extends ModelQuerySupport {
  /**
   * Run an aggregation on a field
   * @param modelClass The model class to aggregate
   * @param operation The operation to perform ('sum', 'avg', 'min', 'max')
   * @param field The field to aggregate on
   * @param query Additional query filtering
   */
  aggregateFieldByQuery<
    T extends ModelType,
    Op extends AggregateOperation,
    F extends (Op extends AggregateNumericOperation ? ValidNumericFields<T> : ValidComparableFields<T>)
  >(
    modelClass: Class<T>,
    operation: Op,
    field: F,
    query?: ModelQuery<T>
  ): Promise<AggregateResultType<T, Op, F>>;
}
