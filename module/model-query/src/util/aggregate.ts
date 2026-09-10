import type { ModelType } from '@travetto/model';
import { castTo, type Class, hasFunction } from '@travetto/runtime';
import { DataUtil, SchemaUtil } from '@travetto/schema';

import type { AggregateOperation, AggregateResultType, ModelQueryAggregateSupport } from '../types/aggregate.ts';

export class ModelQueryAggregateUtil {
  /**
   * Type guard for determining if service supports query aggregate operations
   */
  static isSupported = hasFunction<ModelQueryAggregateSupport>('aggregateFieldByQuery');

  /**
   * Resolve and coerce the aggregate query result using DataUtil.coerceType
   * @param modelClass The model class being queried
   * @param operation The aggregate operation
   * @param field The field being aggregated
   * @param rawValue The raw result value from the datastore
   */
  static resolveResult<T extends ModelType, Op extends AggregateOperation, F extends string>(
    modelClass: Class<T>,
    operation: Op,
    field: F,
    rawValue: unknown
  ): AggregateResultType<T, Op, F> {
    const leafFieldType = SchemaUtil.getFieldConfig(modelClass, field)!.type;
    return castTo(DataUtil.coerceType(rawValue, leafFieldType, false) ?? undefined);
  }
}
