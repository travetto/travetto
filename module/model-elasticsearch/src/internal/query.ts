import { Search } from '@elastic/elasticsearch/api/requestParams';
import { Util } from '@travetto/base';
import { WhereClause, SelectClause, SortClause, Query } from '@travetto/model-query';
import { QueryLanguageParser } from '@travetto/model-query/src/internal/query/parser';
import { QueryVerifier } from '@travetto/model-query/src/internal/query/verifier';
import { ModelRegistry } from '@travetto/model/src/registry/model';
import { ModelType } from '@travetto/model/src/types/model';
import { Class } from '@travetto/registry';
import { SchemaRegistry } from '@travetto/schema';
import { SearchResponse } from '../types';

import { EsSchemaConfig } from './types';

const has$And = (o: any): o is ({ $and: WhereClause<any>[] }) => '$and' in o;
const has$Or = (o: any): o is ({ $or: WhereClause<any>[] }) => '$or' in o;
const has$Not = (o: any): o is ({ $not: WhereClause<any> }) => '$not' in o;

/**
 * Support tools for dealing with elasticsearch specific requirements
 */
export class ElasticsearchQueryUtil {

  /**
   * Convert `a.b.c` to `a : { b : { c : ... }}`
   */
  static extractSimple<T>(o: T, path: string = ''): Record<string, any> {
    const out: Record<string, any> = {};
    const sub = o as Record<string, any>;
    const keys = Object.keys(sub);
    for (const key of keys) {
      const subPath = `${path}${key}`;
      if (Util.isPlainObject(sub[key]) && !Object.keys(sub[key])[0].startsWith('$')) {
        Object.assign(out, this.extractSimple(sub[key], `${subPath}.`));
      } else {
        out[subPath] = sub[key];
      }
    }
    return out;
  }

  /**
   * Build include/exclude from the select clause
   */
  static getSelect<T>(clause: SelectClause<T>) {
    const simp = this.extractSimple(clause);
    const include: string[] = [];
    const exclude: string[] = [];
    for (const k of Object.keys(simp)) {
      const nk = k === 'id' ? '_id' : k;
      const v: (1 | 0 | boolean) = simp[k];
      if (v === 0 || v === false) {
        exclude.push(nk);
      } else {
        include.push(nk);
      }
    }
    return [include, exclude];
  }

  /**
   * Build sort mechanism
   */
  static getSort<T>(sort: SortClause<T>[]) {
    return sort.map(x => {
      const o = this.extractSimple(x);
      const k = Object.keys(o)[0];
      const v = o[k] as (boolean | -1 | 1);
      if (v === 1 || v === true) {
        return k;
      } else {
        return `${k}:desc`;
      }
    });
  }

  /**
   * Extract specific term for a class, and a given field
   */
  static extractWhereTermQuery<T>(o: Record<string, any>, cls: Class<T>, config?: EsSchemaConfig, path: string = ''): any {
    const items = [];
    const schema = SchemaRegistry.getViewSchema(cls).schema;

    for (const key of Object.keys(o) as (keyof typeof o)[]) {
      const top = o[key];
      const declaredSchema = schema[key];
      const declaredType = declaredSchema.type;
      const sPath = declaredType === String ?
        ((key === 'id' && !path) ? `_id` : `${path}${key}`) :
        `${path}${key}`;

      if (Util.isPlainObject(top)) {
        const subKey = Object.keys(top)[0];
        if (!subKey.startsWith('$')) {
          const inner = this.extractWhereTermQuery(top, declaredType as Class<any>, config, `${sPath}.`);
          items.push(declaredSchema.array ?
            { nested: { path: sPath, query: inner } } :
            inner
          );
        } else {
          const v = top[subKey];

          switch (subKey) {
            case '$all': {
              const arr = Array.isArray(v) ? v : [v];
              items.push({
                bool: {
                  must: arr.map(x => ({ term: { [sPath]: x } }))
                }
              });
              break;
            }
            case '$in': {
              items.push({ terms: { [sPath]: Array.isArray(v) ? v : [v] } });
              break;
            }
            case '$nin': {
              items.push({
                bool: {
                  ['must_not']: [{
                    terms: {
                      [sPath]: Array.isArray(v) ? v : [v]
                    }
                  }]
                }
              });
              break;
            }
            case '$eq': {
              items.push({ term: { [sPath]: v } });
              break;
            }
            case '$ne': {
              items.push({
                bool: { ['must_not']: [{ term: { [sPath]: v } }] }
              });
              break;
            }
            case '$exists': {
              const q = { exists: { field: sPath } };
              items.push(v ? q : { bool: { ['must_not']: q } });
              break;
            }
            case '$lt':
            case '$gt':
            case '$gte':
            case '$lte': {
              const out: any = {};
              for (const k of Object.keys(top)) {
                out[k.replace(/^[$]/, '')] = top[k];
              }
              items.push({ range: { [sPath]: out } });
              break;
            }
            case '$regex': {
              const pattern = Util.toRegex(v);
              if (pattern.source.startsWith('\\b') && pattern.source.endsWith('.*')) {
                const textField = !pattern.flags.includes('i') && config && config.caseSensitive ?
                  `${sPath}.text_cs` :
                  `${sPath}.text`;
                const query = pattern.source.substring(2, pattern.source.length - 2);
                items.push({
                  ['match_phrase_prefix']: {
                    [textField]: query
                  }
                });
              } else {
                items.push({ regexp: { [sPath]: pattern.source } });
              }
              break;
            }
            case '$geoWithin': {
              items.push({ ['geo_polygon']: { [sPath]: { points: v } } });
              break;
            }
            case '$unit':
            case '$maxDistance':
            case '$near': {
              let dist = top.$maxDistance;
              let unit = top.$unit ?? 'm';
              if (unit === 'rad') {
                dist = 6378.1 * dist;
                unit = 'km';
              }
              items.push({
                ['geo_distance']: {
                  distance: `${dist}${unit}`,
                  [sPath]: top.$near
                }
              });
              break;
            }
          }
        }
        // Handle operations
      } else {
        items.push({
          [Array.isArray(top) ? 'terms' : 'term']: {
            [(key === 'id' && !path) ? `_id` : `${path}${key}`]: top
          }
        });
      }
    }
    if (items.length === 1) {
      return items[0];
    } else {
      return { bool: { must: items } };
    }
  }

  /**
   * Build query from the where clause
   */
  static extractWhereQuery<T>(cls: Class<T>, o: WhereClause<T>, config?: EsSchemaConfig): Record<string, any> {
    if (has$And(o)) {
      return { bool: { must: o.$and.map(x => this.extractWhereQuery<T>(cls, x, config)) } };
    } else if (has$Or(o)) {
      return { bool: { should: o.$or.map(x => this.extractWhereQuery<T>(cls, x, config)), ['minimum_should_match']: 1 } };
    } else if (has$Not(o)) {
      return { bool: { ['must_not']: this.extractWhereQuery<T>(cls, o.$not, config) } };
    } else {
      return this.extractWhereTermQuery(o, cls, config);
    }
  }

  /**
   * Build a base search object from a class and a query
   */
  static getSearchObject<T extends ModelType>(cls: Class<T>, query: Query<T>, config?: EsSchemaConfig, subTypeAware?: boolean): Search {
    query.where = query.where ? (typeof query.where === 'string' ? QueryLanguageParser.parseToQuery(query.where) : query.where) : {};

    if (subTypeAware) {
      const conf = ModelRegistry.get(cls);
      if (conf.subType) {
        const filterClause = { type: conf.subType };
        query.where = (Object.keys(query.where!).length > 0 ? { $and: [query.where, filterClause] } : filterClause) as WhereClause<T>;
      }
    }

    QueryVerifier.verify(cls, query); // Verify

    const q = this.extractWhereQuery(cls, query.where as WhereClause<T>, config);
    const search: Search = {
      body: q ? { query: q } : {}
    };

    const sort = query.sort;

    if (query.select) {
      const [inc, exc] = this.getSelect(query.select);
      if (inc.length) {
        search._source_includes = inc;
      }
      if (exc.length) {
        search._source_excludes = exc;
      }
    }

    if (sort) {
      search.sort = this.getSort(sort);
    }

    if (query.offset && typeof query.offset === 'number') {
      search.from = query.offset;
    }

    if (query.limit) {
      search.size = query.limit;
    }

    return search;
  }


  /**
   * Safely load the data, excluding ids if needed
   */
  static cleanIdRemoval<T>(req: Search, results: SearchResponse<T>): T[] {
    const out: T[] = [];

    const toArr = <V>(x: V | V[] | undefined) => (x ? (Array.isArray(x) ? x : [x]) : []);

    // determine if id
    const select = [
      toArr(req._source_includes),
      toArr(req._source_excludes)
    ];
    const includeId = select[0].includes('_id') || (select[0].length === 0 && !select[1].includes('_id'));

    for (const r of results.body.hits.hits) {
      const obj = r._source;
      if (includeId) {
        // @ts-ignore
        obj._id = r._id;
      }
      out.push(obj);
    }

    return out;
  }
}