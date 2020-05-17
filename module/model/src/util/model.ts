import { Class } from '@travetto/registry';
import { AppError } from '@travetto/base';
import { Query, PageableModelQuery, SelectClause } from '../model/query';
import { ModelCore } from '../model/core';
import { ValidStringFields } from '../service/source';
import { WhereClauseRaw } from '../model/where-clause';

/**
 * Common model utils, that should be usable by end users
 */
export class ModelUtil {
  /**
   * Verify result set is singular, and decide if failing on many should happen
   */
  static verifyGetSingleCounts<T>(cls: Class<T>, res?: T[], failOnMany = true) {
    res = res ?? [];
    if (res.length === 1 || res.length > 1 && !failOnMany) {
      return res[0] as T;
    }
    throw new AppError(`Invalid number of results for find by id: ${res.length}`, res.length < 1 ? 'notfound' : 'data');
  }

  /**
   * Build regex for suggesting
   */
  static getSuggestRegex(prefix?: string) {
    return prefix ? new RegExp(`\\b${prefix}.*`, 'i') : /./;
  }

  /**
   * Build suggest query on top of query language
   */
  static getSuggestQuery<T>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: Query<T>) {
    const re = this.getSuggestRegex(prefix);
    const limit = query?.limit ?? 10;
    // @ts-ignore
    const where: WhereClauseRaw<T> = { [field]: { $regex: re } };

    const q = {
      where: query && query.where ? { $and: [where, query.where!] } : where,
      limit
    } as Query<T>;
    if (query && query.select) {
      q.select = query.select;
    }
    return q;
  }

  /**
   * Join suggestion results
   */
  static combineSuggestResults<T, U>(
    cls: Class<T>, field: ValidStringFields<T>,
    prefix: string = '', results: T[],
    transform: (value: string, entity: T) => U,
    limit?: number
  ): U[] {
    const pattern = this.getSuggestRegex(prefix);

    const out: [string, U][] = [];
    for (const r of results) {
      // @ts-ignore
      const val: string | string[] = r[field];
      if (Array.isArray(val)) {
        out.push(...val.filter(f => pattern.test(f)).map(f => [f, transform(f, r)] as [string, U]));
      } else {
        out.push([val, transform(val, r)]);
      }
    }
    return out
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map((a) => a[1])
      .filter((x, i, arr) => x !== arr[i - 1])
      .slice(0, limit ?? 10);
  }

  /**
   * Build suggestion query
   */
  static getSuggestFieldQuery<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>) {
    return this.getSuggestQuery(cls, field, prefix, {
      ...(query ?? {}),
      select: { [field]: true } as SelectClause<T>
    });
  }
}