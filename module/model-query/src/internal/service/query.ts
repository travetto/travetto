import { Class, AppError } from '@travetto/base';
import { ModelRegistry, NotFoundError } from '@travetto/model';
import { ModelType } from '@travetto/model/src/types/model';

import { ModelQuery, Query } from '../../model/query';
import { WhereClause, WhereClauseRaw } from '../../model/where-clause';
import { QueryLanguageParser } from '../query/parser';
import { QueryVerifier } from '../query/verifier';

/**
 * Common model utils, that should be usable by end users
 */
export class ModelQueryUtil {
  /**
   * Verify result set is singular, and decide if failing on many should happen
   */
  static verifyGetSingleCounts<T>(cls: Class<T>, res?: T[], failOnMany = true) {
    res = res ?? [];
    if (res.length === 1 || res.length > 1 && !failOnMany) {
      return res[0] as T;
    }
    throw res.length === 0 ? new NotFoundError(cls, 'none') : new AppError(`Invalid number of results for find by id: ${res.length}`, 'data');
  }

  /**
   * Get a where clause with type
   */
  static getWhereClause<T extends ModelType>(cls: Class<T>, o: WhereClause<T> | string | undefined, checkExpiry = true): WhereClause<T> {
    let q = o ? (typeof o === 'string' ? QueryLanguageParser.parseToQuery(o) as WhereClause<T> : o) : undefined;
    const clauses = (q ? [q] : []) as WhereClauseRaw<T>[];

    const conf = ModelRegistry.get(cls);
    if (conf.subType) {
      clauses.push({ type: conf.subType } as WhereClauseRaw<T>);
    }
    if (checkExpiry && conf.expiresAt) {
      clauses.push({
        $or: [
          { [conf.expiresAt]: { $exists: false } },
          { [conf.expiresAt]: { $gte: new Date() } },
        ]
      } as WhereClauseRaw<T>);
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
  static getQueryAndVerify<T extends ModelType, U extends Query<T> | ModelQuery<T>>(cls: Class<T>, query: U, checkExpiry = true) {
    query.where = this.getWhereClause(cls, query.where, checkExpiry);
    QueryVerifier.verify(cls, query);
    return query as U & { where: WhereClause<T> };
  }
}