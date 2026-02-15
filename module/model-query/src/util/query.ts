import { type Class, RuntimeError, TimeUtil, castTo, hasFunction } from '@travetto/runtime';
import { type ModelType, NotFoundError, ModelRegistryIndex } from '@travetto/model';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { WhereClause, WhereClauseRaw } from '../model/where-clause.ts';
import type { ModelQuerySupport } from '../types/query.ts';

/**
 * Common model utils, that should be usable by end users
 */
export class ModelQueryUtil {

  /**
   * Type guard for determining if service supports query operations
   */
  static isSupported = hasFunction<ModelQuerySupport>('query');

  /**
   * Resolve comparator
   * @param value
   * @returns
   */
  static resolveComparator(value: unknown): unknown {
    if (typeof value === 'string' && TimeUtil.isTimeSpan(value)) {
      return TimeUtil.fromNow(value);
    } else {
      return value;
    }
  }

  /**
   * Verify result set is singular, and decide if failing on many should happen
   */
  static verifyGetSingleCounts<T extends ModelType>(cls: Class<T>, failOnMany: boolean, result?: T[], where?: WhereClause<T>): T {
    result = result ?? [];
    if (result.length === 1 || result.length > 1 && !failOnMany) {
      return result[0]!;
    }
    const requestedId = ((where && 'id' in where && typeof where.id === 'string') ? where.id : undefined);
    if (result.length === 0) {
      if (requestedId) {
        throw new NotFoundError(cls, requestedId);
      } else {
        const error = new NotFoundError(cls, 'unknown');
        error.message = 'No results found for query';
        throw error;
      }
    } else {
      throw new RuntimeError(`Invalid number of results: ${result.length}`, { category: 'data' });
    }
  }

  /**
   * Get a where clause with type
   */
  static getWhereClause<T extends ModelType>(cls: Class<T>, where: WhereClause<T> | undefined, checkExpiry = true): WhereClause<T> {
    const clauses: WhereClauseRaw<T>[] = (where ? [where] : []);

    const polymorphicConfig = SchemaRegistryIndex.getDiscriminatedConfig(cls);
    if (polymorphicConfig) {
      clauses.push(castTo(polymorphicConfig.discriminatedBase ? {
        [polymorphicConfig.discriminatedField]: { $in: SchemaRegistryIndex.getDiscriminatedTypes(cls) }
      } : {
        [polymorphicConfig.discriminatedField]: polymorphicConfig.discriminatedType
      }
      ));
    }

    const indexConfig = ModelRegistryIndex.getConfig(cls);
    if (checkExpiry && indexConfig.expiresAt) {
      clauses.push(castTo({
        $or: [
          { [indexConfig.expiresAt]: { $exists: false } },
          { [indexConfig.expiresAt]: undefined },
          { [indexConfig.expiresAt]: { $gte: new Date() } },
        ]
      }));
    }
    if (clauses.length > 1) {
      where = { $and: clauses };
    } else {
      where = clauses[0];
    }
    return where!;
  }

  static has$And = (value: unknown): value is ({ $and: WhereClause<unknown>[] }) =>
    !!value && typeof value === 'object' && '$and' in value;
  static has$Or = (value: unknown): value is ({ $or: WhereClause<unknown>[] }) =>
    !!value && typeof value === 'object' && '$or' in value;
  static has$Not = (value: unknown): value is ({ $not: WhereClause<unknown> }) =>
    !!value && typeof value === 'object' && '$not' in value;
}