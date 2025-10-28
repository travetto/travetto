import { Class, AppError, TimeUtil, castTo, hasFunction } from '@travetto/runtime';
import { ModelType, ModelRegistry, NotFoundError } from '@travetto/model';
import { RegistryV2 } from '@travetto/registry';
import { SchemaRegistryIndex } from '@travetto/schema';

import { WhereClause, WhereClauseRaw } from '../model/where-clause.ts';
import { ModelQuerySupport } from '../types/query.ts';

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
   * @param val
   * @returns
   */
  static resolveComparator(val: unknown): unknown {
    if (typeof val === 'string' && TimeUtil.isTimeSpan(val)) {
      return TimeUtil.fromNow(val);
    } else {
      return val;
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
        const err = new NotFoundError(cls, 'unknown');
        err.message = 'No results found for query';
        throw err;
      }
    } else {
      throw new AppError(`Invalid number of results: ${result.length}`, { category: 'data' });
    }
  }

  /**
   * Get a where clause with type
   */
  static getWhereClause<T extends ModelType>(cls: Class<T>, q: WhereClause<T> | undefined, checkExpiry = true): WhereClause<T> {
    const clauses: WhereClauseRaw<T>[] = (q ? [q] : []);

    const conf = ModelRegistry.get(cls);
    if (conf.subType) {
      const { subTypeField, subTypeName } = RegistryV2.get(SchemaRegistryIndex, cls).get();
      clauses.push(castTo({ [subTypeField]: subTypeName }));
    }
    if (checkExpiry && conf.expiresAt) {
      clauses.push(castTo({
        $or: [
          { [conf.expiresAt]: { $exists: false } },
          { [conf.expiresAt]: undefined },
          { [conf.expiresAt]: { $gte: new Date() } },
        ]
      }));
    }
    if (clauses.length > 1) {
      q = { $and: clauses };
    } else {
      q = clauses[0];
    }
    return q!;
  }

  static has$And = (o: unknown): o is ({ $and: WhereClause<unknown>[] }) =>
    !!o && typeof o === 'object' && '$and' in o;
  static has$Or = (o: unknown): o is ({ $or: WhereClause<unknown>[] }) =>
    !!o && typeof o === 'object' && '$or' in o;
  static has$Not = (o: unknown): o is ({ $not: WhereClause<unknown> }) =>
    !!o && typeof o === 'object' && '$not' in o;
}