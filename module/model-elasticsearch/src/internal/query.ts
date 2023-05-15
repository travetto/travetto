import { QueryDslQueryContainer, SearchRequest, SearchResponse, Sort, SortOptions } from '@elastic/elasticsearch/lib/api/types';

import { Class, DataUtil, ObjectUtil } from '@travetto/base';
import { WhereClause, SelectClause, SortClause, Query } from '@travetto/model-query';
import { QueryLanguageParser } from '@travetto/model-query/src/internal/query/parser';
import { QueryVerifier } from '@travetto/model-query/src/internal/query/verifier';
import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { ModelRegistry } from '@travetto/model/src/registry/model';
import { IndexConfig } from '@travetto/model/src/registry/types';
import { ModelType } from '@travetto/model/src/types/model';
import { SchemaRegistry } from '@travetto/schema';

import { EsSchemaConfig } from './types';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const has$And = (o: unknown): o is ({ $and: WhereClause<unknown>[] }) => !!o && '$and' in (o as object);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const has$Or = (o: unknown): o is ({ $or: WhereClause<unknown>[] }) => !!o && '$or' in (o as object);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const has$Not = (o: unknown): o is ({ $not: WhereClause<unknown> }) => !!o && '$not' in (o as object);

/**
 * Support tools for dealing with elasticsearch specific requirements
 */
export class ElasticsearchQueryUtil {

  /**
   * Convert `a.b.c` to `a : { b : { c : ... }}`
   */
  static extractSimple<T>(o: T, path: string = ''): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sub = o as Record<string, unknown>;
    const keys = Object.keys(sub);
    for (const key of keys) {
      const subPath = `${path}${key}`;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if (ObjectUtil.isPlainObject(sub[key]) && !Object.keys(sub[key] as Record<string, unknown>)[0].startsWith('$')) {
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
  static getSelect<T>(clause: SelectClause<T>): [string[], string[]] {
    const simp = this.extractSimple(clause);
    const include: string[] = [];
    const exclude: string[] = [];
    for (const k of Object.keys(simp)) {
      const nk = k === 'id' ? '_id' : k;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const v = simp[k] as (1 | 0 | boolean);
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
  static getSort<T extends ModelType>(sort: SortClause<T>[] | IndexConfig<T>['fields']): Sort {
    return sort.map<SortOptions>(x => {
      const o = this.extractSimple(x);
      const k = Object.keys(o)[0];
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const v = o[k] as (boolean | -1 | 1);
      return { [k]: { order: v === 1 || v === true ? 'asc' : 'desc' } };
    });
  }

  /**
   * Extract specific term for a class, and a given field
   */
  static extractWhereTermQuery<T>(cls: Class<T>, o: Record<string, unknown>, config?: EsSchemaConfig, path: string = ''): Record<string, unknown> {
    const items = [];
    const schema = SchemaRegistry.getViewSchema(cls).schema;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const key of Object.keys(o) as (keyof typeof o)[]) {
      const top = o[key];
      const declaredSchema = schema[key];
      const declaredType = declaredSchema.type;
      const sPath = declaredType === String ?
        ((key === 'id' && !path) ? '_id' : `${path}${key}`) :
        `${path}${key}`;

      if (ObjectUtil.isPlainObject(top)) {
        const subKey = Object.keys(top)[0];
        if (!subKey.startsWith('$')) {
          const inner = this.extractWhereTermQuery(declaredType, top, config, `${sPath}.`);
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
              const out: Record<string, unknown> = {};
              for (const k of Object.keys(top)) {
                out[k.replace(/^[$]/, '')] = ModelQueryUtil.resolveComparator(top[k]);
              }
              items.push({ range: { [sPath]: out } });
              break;
            }
            case '$empty': {
              const q = {
                exists: { field: sPath }
              };
              items.push(!v ? q : { bool: { ['must_not']: q } });
              break;
            }
            case '$regex': {
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              const pattern = DataUtil.toRegex(v as string);
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
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                dist = 6378.1 * (dist as number);
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
            [(key === 'id' && !path) ? '_id' : `${path}${key}`]: top
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
  static extractWhereQuery<T>(cls: Class<T>, o: WhereClause<T>, config?: EsSchemaConfig): Record<string, unknown> {
    if (has$And(o)) {
      return { bool: { must: o.$and.map(x => this.extractWhereQuery<T>(cls, x, config)) } };
    } else if (has$Or(o)) {
      return { bool: { should: o.$or.map(x => this.extractWhereQuery<T>(cls, x, config)), ['minimum_should_match']: 1 } };
    } else if (has$Not(o)) {
      return { bool: { ['must_not']: this.extractWhereQuery<T>(cls, o.$not, config) } };
    } else {
      return this.extractWhereTermQuery(cls, o, config);
    }
  }

  /**
   * Generate final search query
   * @param cls
   * @param search
   */
  static getSearchQuery<T extends ModelType>(cls: Class<T>, search: Record<string, unknown>, checkExpiry = true): QueryDslQueryContainer {
    const clauses = [];
    if (search && Object.keys(search).length) {
      clauses.push(search);
    }
    const { expiresAt, subType } = ModelRegistry.get(cls);
    if (checkExpiry && expiresAt) {
      clauses.push({
        bool: {
          should: [
            { exists: { field: expiresAt } },
            { range: { [expiresAt]: { gte: new Date().toISOString() } } },
          ],
          minimum_should_match: 1
        },
      });
    }
    if (subType) {
      const { subTypeField, subTypeName } = SchemaRegistry.get(cls);
      clauses.push({
        term: { [subTypeField]: { value: subTypeName } }
      });
    }
    return clauses.length === 0 ? {} :
      clauses.length === 1 ? clauses[0] :
        { bool: { must: clauses } };
  }

  /**
   * Build a base search object from a class and a query
   */
  static getSearchObject<T extends ModelType>(cls: Class<T>, query: Query<T>, config?: EsSchemaConfig, checkExpiry = true): SearchRequest {
    query.where = query.where ? (typeof query.where === 'string' ? QueryLanguageParser.parseToQuery(query.where) : query.where) : {};
    QueryVerifier.verify(cls, query); // Verify

    const search: SearchRequest = {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      query: this.getSearchQuery(cls, this.extractWhereQuery(cls, query.where as WhereClause<T>, config), checkExpiry)
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
  static cleanIdRemoval<T>(req: SearchRequest, results: SearchResponse<T>): T[] {
    const out: T[] = [];

    const toArr = <V>(x: V | V[] | undefined): V[] => (x ? (Array.isArray(x) ? x : [x]) : []);

    // determine if id
    const select = [
      toArr(req._source_includes),
      toArr(req._source_excludes)
    ];
    const includeId = select[0].includes('_id') || (select[0].length === 0 && !select[1].includes('_id'));

    for (const r of results.hits.hits) {
      const obj = r._source!;
      if (includeId) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (obj as unknown as { _id: string })._id = r._id;
      }
      out.push(obj);
    }

    return out;
  }
}