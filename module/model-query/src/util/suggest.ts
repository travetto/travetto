import { ModelRegistryIndex, ModelType } from '@travetto/model';
import { castTo, Class, hasFunction } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { PageableModelQuery, Query } from '../model/query.ts';
import { ValidStringFields, WhereClauseRaw } from '../model/where-clause.ts';
import { ModelQuerySuggestSupport } from '../types/suggest.ts';

/**
 * Tools for building suggestion queries
 */
export class ModelQuerySuggestUtil {

  /**
   * Type guard for determining if service supports query suggest operations
   */
  static isSupported = hasFunction<ModelQuerySuggestSupport>('suggest');

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
    const config = ModelRegistryIndex.getConfig(cls);
    const limit = query?.limit ?? 10;
    const clauses: WhereClauseRaw<ModelType>[] = prefix ? [{ [field]: { $regex: this.getSuggestRegex(prefix) } }] : [];

    if (config.subType) {
      const { subTypeField, subTypeName } = SchemaRegistryIndex.getConfig(cls);
      clauses.push({ [subTypeField]: subTypeName });
    }

    if (config.expiresAt) {
      clauses.push({ [config.expiresAt]: { $gt: new Date() } });
    }

    if (query?.where) {
      clauses.push(query.where);
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

    const out: ([string, U] | readonly [string, U])[] = [];
    for (const r of results) {
      const val = r[field];
      if (Array.isArray(val)) {
        out.push(...val.filter(f => pattern.test(f)).map((f: string) => [f, transform(f, r)] as const));
      } else if (typeof val === 'string') {
        out.push([val, transform(val, r)]);
      }
    }
    return out
      .toSorted((a, b) => a[0].localeCompare(b[0]))
      .map((a) => a[1])
      .filter((x, i, arr) => x !== arr[i - 1])
      .slice(0, limit ?? 10);
  }

  /**
   * Build suggestion query
   */
  static getSuggestFieldQuery<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Query<T> {
    const config = ModelRegistryIndex.getConfig(cls);
    return this.getSuggestQuery<T>(cls, castTo(field), prefix, {
      ...(query ?? {}),
      select: castTo({
        [field]: true, ...(config.subType ? {
          [SchemaRegistryIndex.getConfig(cls).subTypeField]: true
        } : {})
      })
    });
  }
}