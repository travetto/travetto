import { Class } from '@travetto/registry';
import { AppError } from '@travetto/base';
import { Query, PageableModelQuery } from '../model/query';
import { ModelCore } from '../model/core';
import { ValidStringFields } from '../service/source';

export class ModelUtil {
  static verifyGetSingleCounts<T>(cls: Class<T>, res?: T[], failOnMany = true) {
    res = res || [];
    if (res.length === 1 || res.length > 1 && !failOnMany) {
      return res[0] as T;
    }
    throw new AppError(`Invalid number of results for find by id: ${res.length}`, res.length < 1 ? 'notfound' : 'data');
  }

  static getSuggestRegex(prefix?: string) {
    return prefix ? new RegExp(`\\b${prefix}.*`, 'i') : /./;
  }

  static getSuggestQuery<T>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: Query<T>) {
    const re = this.getSuggestRegex(prefix);
    const limit = query && query.limit || 10;
    const where = { [field]: { $regex: re } } as any;

    return {
      query: {
        select: query && query.select || {},
        where: query && query.where ? { $and: [where, query.where!] } : where,
        limit
      }
    } as Query<T>;
  }

  static combineSuggestResults<T, U>(
    cls: Class<T>, field: ValidStringFields<T>,
    prefix: string = '', results: T[],
    transform: (value: string, entity: T) => U, limit?: number
  ): U[] {
    const pattern = this.getSuggestRegex(prefix);

    const out: [string, U][] = [];
    for (const r of results) {
      const val = (r as any)[field] as string | string[];
      if (Array.isArray(val)) {
        out.push(...val.filter(f => pattern.test(f)).map(f => [f, transform(f, r)] as [string, U]));
      } else {
        out.push([val, transform(val, r)]);
      }
    }
    return out
      .sort((a, b) => a[0].localeCompare(b[0])).map((a) => a[1])
      .slice(limit || 10);
  }

  static getSuggestFieldQuery<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>) {
    return this.getSuggestQuery(cls, field, prefix, {
      ...(query || {}),
      select: { [field]: true } as any
    });
  }
}