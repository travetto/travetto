import { Class, AppError, TimeUtil, castTo } from '@travetto/runtime';
import { ModelRegistry, NotFoundError } from '@travetto/model';
import { ModelType } from '@travetto/model/src/types/model';
import { SchemaRegistry } from '@travetto/schema';

import { ModelQuery, Query } from '../../model/query';
import { WhereClause, WhereClauseRaw } from '../../model/where-clause';
import { QueryLanguageParser } from '../query/parser';
import { QueryVerifier } from '../query/verifier';

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
  static verifyGetSingleCounts<T>(cls: Class<T>, res?: T[], failOnMany = true): T {
    res = res ?? [];
    if (res.length === 1 || res.length > 1 && !failOnMany) {
      return res[0]!;
    }
    throw res.length === 0 ? new NotFoundError(cls, 'none') : new AppError(`Invalid number of results for find by id: ${res.length}`, 'data');
  }

  /**
   * Get a where clause with type
   */
  static getWhereClause<T extends ModelType>(cls: Class<T>, o: WhereClause<T> | string | undefined, checkExpiry = true): WhereClause<T> {
    let q: WhereClause<T> | undefined = o ? (typeof o === 'string' ? QueryLanguageParser.parseToQuery(o) : o) : undefined;
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

  /**
   * Enrich query where clause, and verify query is correct
   */
  static getQueryAndVerify<T extends ModelType, U extends Query<T> | ModelQuery<T>>(
    cls: Class<T>, query: U, checkExpiry = true
  ): U & { where: WhereClause<T> } {
    query.where = this.getWhereClause(cls, query.where, checkExpiry);
    QueryVerifier.verify(cls, query);
    return castTo(query);
  }

  /**
   * Get query with an id enforced
   */
  static getQueryWithId<T extends ModelType, U extends Query<T> | ModelQuery<T>>(
    cls: Class<T>,
    item: T,
    query: U
  ): U & { where: WhereClause<T> & { id: string } } {
    query.where = this.getWhereClause(cls, query.where);
    castTo<WhereClauseRaw<ModelType>>(query.where).id = item.id;
    return castTo(query);
  }

  static has$And = (o: unknown): o is ({ $and: WhereClause<unknown>[] }) =>
    !!o && typeof o === 'object' && '$and' in o;
  static has$Or = (o: unknown): o is ({ $or: WhereClause<unknown>[] }) =>
    !!o && typeof o === 'object' && '$or' in o;
  static has$Not = (o: unknown): o is ({ $not: WhereClause<unknown> }) =>
    !!o && typeof o === 'object' && '$not' in o;
}