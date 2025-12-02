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
    const limit = query?.limit ?? 10;
    const clauses: WhereClauseRaw<ModelType>[] = prefix ? [{ [field]: { $regex: this.getSuggestRegex(prefix) } }] : [];
    const select: Query<T>['select'] = {
      ...query?.select
    };

    const polymorphicConfig = SchemaRegistryIndex.getDiscriminatedConfig(cls);
    if (polymorphicConfig) {
      clauses.push({
        [polymorphicConfig.discriminatedField]: polymorphicConfig.discriminatedBase ?
          { $in: SchemaRegistryIndex.getDiscriminatedTypes(cls) } :
          polymorphicConfig.discriminatedType
      });
      if (query?.select) {
        Object.assign(select, { [polymorphicConfig.discriminatedField]: true });
      }
    }

    const config = ModelRegistryIndex.getConfig(cls);
    if (config.expiresAt) {
      clauses.push({ [config.expiresAt]: { $gt: new Date() } });
    }

    if (query?.where) {
      clauses.push(query.where);
    }

    return {
      where: clauses.length ? (clauses.length > 1 ? { $and: clauses } : clauses[0]) : {},
      limit,
      select
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
    for (const result of results) {
      const resultValue = result[field];
      if (Array.isArray(resultValue)) {
        out.push(...resultValue.filter(item => pattern.test(item)).map((item: string) => [item, transform(item, result)] as const));
      } else if (typeof resultValue === 'string') {
        out.push([resultValue, transform(resultValue, result)]);
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
    return this.getSuggestQuery<T>(cls, castTo(field), prefix, query);
  }
}