import { ModelRegistry, ModelType } from '@travetto/model';
import { Class } from '@travetto/base';
import { SchemaRegistry } from '@travetto/schema';

import { PageableModelQuery, Query } from '../../model/query';
import { ValidStringFields, WhereClauseRaw } from '../../model/where-clause';

/**
 * Tools for building suggestion queries
 */
export class ModelQuerySuggestUtil {

  /**
   * Build regex for suggesting
   */
  static getSuggestRegex(prefix?: string): RegExp {
    return prefix ? new RegExp(`\\b${prefix}.*`, 'i') : /./;
  }

  /**
   * Build suggest query on top of query language
   */
  static getSuggestQuery<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: Query<T>): Query<T> {
    const config = ModelRegistry.get(cls);
    const limit = query?.limit ?? 10;
    const clauses: WhereClauseRaw<ModelType>[] = prefix ? [{ [field]: { $regex: this.getSuggestRegex(prefix) } }] : [];

    if (config.subType) {
      clauses.push({ type: SchemaRegistry.getSubTypeName(cls) });
    }

    if (config.expiresAt) {
      clauses.push({ [config.expiresAt]: { $gt: new Date() } });
    }

    if (query?.where) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      clauses.push(query.where! as WhereClauseRaw<ModelType>);
    }

    return {
      where: clauses.length ? (clauses.length > 1 ? { $and: clauses } : clauses[0]) : {},
      limit,
      select: query?.select
    };
  }

  /**
   * Join suggestion results
   */
  static combineSuggestResults<T extends ModelType, U>(
    cls: Class<T>,
    field: ValidStringFields<T>,
    prefix: string = '',
    results: T[],
    transform: (value: string, entity: T) => U,
    limit?: number
  ): U[] {
    const pattern = this.getSuggestRegex(prefix);

    const out: [string, U][] = [];
    for (const r of results) {
      const val = r[field];
      if (Array.isArray(val)) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        out.push(...val.filter(f => pattern.test(f)).map((f: string) => [f, transform(f, r)] as [string, U]));
      } else if (typeof val === 'string') {
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
  static getSuggestFieldQuery<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Query<T> {
    const config = ModelRegistry.get(cls);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.getSuggestQuery<ModelType>(cls, field as ValidStringFields<ModelType>, prefix, {
      ...(query ?? {}),
      select: { [field]: true, ...(config.subType ? { type: true } : {}) }
    }) as Query<T>;
  }
}