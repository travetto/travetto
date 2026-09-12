import type { ModelType } from '@travetto/model';
import { castTo, type Class, hasFunction } from '@travetto/runtime';
import { DataUtil, SchemaRegistryIndex } from '@travetto/schema';

import type { ValidComparableFields } from '../model/where-clause.ts';
import type { AggregateResultType, FieldAggregateResult, ModelQueryAggregateSupport } from '../types/aggregate.ts';

export class ModelQueryAggregateUtil {
  /**
   * Type guard for determining if service supports query aggregate operations
   */
  static isSupported = hasFunction<ModelQueryAggregateSupport>('aggregateFieldByQuery');

  /**
   * Resolve and coerce aggregate query results
   * @param modelClass The model class being queried
   * @param field The field being aggregated
   * @param rawValues The raw result values from the datastore
   */
  static resolveAggregate<T extends ModelType, F extends ValidComparableFields<T>>(
    modelClass: Class<T>,
    field: F,
    rawValues: { count?: unknown; min?: unknown; max?: unknown; avg?: unknown; sum?: unknown }
  ): FieldAggregateResult<T, F> {
    const count = Number(rawValues.count ?? 0);
    if (count === 0) {
      return castTo({ count: 0 });
    }
    const leafFieldType = SchemaRegistryIndex.getNestedFieldConfig(modelClass, field)!.type;
    const coerce = (value: unknown): AggregateResultType<T, F> => castTo(DataUtil.coerceType(value, leafFieldType, false) ?? undefined);

    if (leafFieldType === Date) {
      return castTo({
        count,
        min: coerce(rawValues.min),
        max: coerce(rawValues.max)
      });
    }

    return castTo({
      count,
      min: coerce(rawValues.min),
      max: coerce(rawValues.max),
      avg: coerce(rawValues.avg),
      sum: coerce(rawValues.sum)
    });
  }
}
