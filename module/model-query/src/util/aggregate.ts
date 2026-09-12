import type { ModelType } from '@travetto/model';
import { castTo, type Class, hasFunction } from '@travetto/runtime';
import { DataUtil, SchemaRegistryIndex } from '@travetto/schema';

import type { ValidComparableFields } from '../model/where-clause.ts';
import type { FieldAggregateResult, ModelQueryAggregateSupport, NumberFieldAggregateResult } from '../types/aggregate.ts';

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
    rawValues: Partial<Record<keyof NumberFieldAggregateResult, unknown>>
  ): FieldAggregateResult<T, F> {
    const count = Number(rawValues.count ?? 0);
    if (count === 0) {
      return { count: 0 };
    }
    const leafFieldType = SchemaRegistryIndex.getNestedFieldConfig(modelClass, field)!.type;

    if (leafFieldType === Date) {
      return castTo({
        count,
        min: DataUtil.coerceType(rawValues.min, leafFieldType, true),
        max: DataUtil.coerceType(rawValues.max, leafFieldType, true)
      });
    }

    return castTo({
      count,
      min: DataUtil.coerceType(rawValues.min, leafFieldType, true),
      max: DataUtil.coerceType(rawValues.max, leafFieldType, true),
      avg: DataUtil.coerceType(rawValues.avg, leafFieldType, true),
      sum: DataUtil.coerceType(rawValues.sum, leafFieldType, true)
    });
  }
}
