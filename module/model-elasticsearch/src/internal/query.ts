import { estypes } from '@elastic/elasticsearch';

import { castTo, Class, TypedObject } from '@travetto/runtime';
import { WhereClause, SelectClause, SortClause, Query, ModelQueryUtil } from '@travetto/model-query';
import { IndexConfig, ModelType, ModelRegistryIndex } from '@travetto/model';
import { DataUtil, SchemaRegistryIndex } from '@travetto/schema';

import { EsSchemaConfig } from './types.ts';

/**
 * Support tools for dealing with elasticsearch specific requirements
 */
export class ElasticsearchQueryUtil {

  /**
   * Convert `a.b.c` to `a : { b : { c : ... }}`
   */
  static extractSimple<T>(o: T, path: string = ''): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const keys = TypedObject.keys(o);
    for (const key of keys) {
      const subPath = `${path}${key}`;
      if (DataUtil.isPlainObject(o[key]) && !Object.keys(o[key])[0].startsWith('$')) {
        Object.assign(out, this.extractSimple(o[key], `${subPath}.`));
      } else {
        out[subPath] = o[key];
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
      const v: 1 | 0 | boolean = castTo(simp[k]);
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
  static getSort<T extends ModelType>(sort: SortClause<T>[] | IndexConfig<T>['fields']): estypes.Sort {
    return sort.map<estypes.SortOptions>(x => {
      const o = this.extractSimple(x);
      const k = Object.keys(o)[0];
      const v: boolean | -1 | 1 = castTo(o[k]);
      return { [k]: { order: v === 1 || v === true ? 'asc' : 'desc' } };
    });
  }

  /**
   * Extract specific term for a class, and a given field
   */
  static extractWhereTermQuery<T>(cls: Class<T>, o: Record<string, unknown>, config?: EsSchemaConfig, path: string = ''): Record<string, unknown> {
    const items = [];
    const fields = SchemaRegistryIndex.get(cls).getFields();

    for (const key of TypedObject.keys(o)) {
      const top = o[key];
      const declaredSchema = fields[key];
      const declaredType = declaredSchema.type;
      const sPath = declaredType === String ?
        ((key === 'id' && !path) ? '_id' : `${path}${key}`) :
        `${path}${key}`;

      const sPathQuery = (val: unknown): {} => (key === 'id' && !path) ?
        { ids: { values: Array.isArray(val) ? val : [val] } } :
        { [Array.isArray(val) ? 'terms' : 'term']: { [sPath]: val } };

      if (DataUtil.isPlainObject(top)) {
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
              items.push(sPathQuery(Array.isArray(v) ? v : [v]));
              break;
            }
            case '$nin': {
              items.push({ bool: { ['must_not']: [sPathQuery(Array.isArray(v) ? v : [v])] } });
              break;
            }
            case '$eq': {
              items.push(sPathQuery(v));
              break;
            }
            case '$ne': {
              items.push({ bool: { ['must_not']: [sPathQuery(v)] } });
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
            case '$regex': {
              const pattern = DataUtil.toRegex(castTo(v));
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
              if (unit === 'rad' && typeof dist === 'number') {
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
        items.push(sPathQuery(top));
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
    if (ModelQueryUtil.has$And(o)) {
      return { bool: { must: o.$and.map(x => this.extractWhereQuery<T>(cls, x, config)) } };
    } else if (ModelQueryUtil.has$Or(o)) {
      return { bool: { should: o.$or.map(x => this.extractWhereQuery<T>(cls, x, config)), ['minimum_should_match']: 1 } };
    } else if (ModelQueryUtil.has$Not(o)) {
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
  static getSearchQuery<T extends ModelType>(cls: Class<T>, search: Record<string, unknown>, checkExpiry = true): estypes.QueryDslQueryContainer {
    const clauses: estypes.QueryDslQueryContainer[] = [];
    if (search && Object.keys(search).length) {
      clauses.push(search);
    }
    const { expiresAt } = ModelRegistryIndex.getConfig(cls);
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
    const polymorphicConfig = SchemaRegistryIndex.getDiscriminatedConfig(cls);
    if (polymorphicConfig) {
      if (polymorphicConfig.discriminatedBase) {
        clauses.push({ terms: { [polymorphicConfig.discriminatedField]: SchemaRegistryIndex.getDiscriminatedTypes(cls)! } });
      } else {
        clauses.push({ term: { [polymorphicConfig.discriminatedField]: { value: polymorphicConfig.discriminatedType } } });
      }
    }
    return clauses.length === 0 ? {} :
      clauses.length === 1 ? clauses[0] :
        { bool: { must: clauses } };
  }

  /**
   * Build a base search object from a class and a query
   */
  static getSearchObject<T extends ModelType>(
    cls: Class<T>, query: Query<T>, config?: EsSchemaConfig, checkExpiry = true
  ): estypes.SearchRequest & Omit<estypes.DeleteByQueryRequest, 'index' | 'sort'> {
    const search: (estypes.SearchRequest & Omit<estypes.DeleteByQueryRequest, 'index' | 'sort'>) = {
      query: this.getSearchQuery(cls, this.extractWhereQuery(cls, query.where ?? {}, config), checkExpiry)
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
}