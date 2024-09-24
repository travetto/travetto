import { Class, AppError, TimeUtil, castTo } from '@travetto/runtime';
import { ModelRegistry, NotFoundError } from '@travetto/model';
import { ModelType } from '@travetto/model/src/types/model';
import { SchemaRegistry } from '@travetto/schema';

import { WhereClause, WhereClauseRaw } from '../../model/where-clause';

/**
 * Common model utils, that should be usable by end users
 */
export class ModelQueryUtil {

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
  static verifyGetSingleCounts<T extends ModelType>(cls: Class<T>, failOnMany: boolean, res?: T[], where?: WhereClause<T>): T {
    res = res ?? [];
    if (res.length === 1 || res.length > 1 && !failOnMany) {
      return res[0]!;
    }
    const requestedId = ((where && 'id' in where && typeof where.id === 'string') ? where.id : undefined) ?? 'unknown';
    throw res.length === 0 ? new NotFoundError(cls, requestedId, { where }) : new AppError(`Invalid number of results for find by id: ${res.length}`, 'data');
  }

  /**
   * Get a where clause with type
   */
  static getWhereClause<T extends ModelType>(cls: Class<T>, q: WhereClause<T> | undefined, checkExpiry = true): WhereClause<T> {
    const clauses: WhereClauseRaw<T>[] = (q ? [q] : []);

    const conf = ModelRegistry.get(cls);
    if (conf.subType) {
      const { subTypeField, subTypeName } = SchemaRegistry.get(cls);
      clauses.push(castTo({ [subTypeField]: subTypeName }));
    }
    if (checkExpiry && conf.expiresAt) {
      clauses.push(castTo({
        $or: [
          { [conf.expiresAt]: { $exists: false } },
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