import type * as estypes from '@elastic/elasticsearch/api/types';

import { castTo, type Class, TypedObject } from '@travetto/runtime';
import { type WhereClause, type SelectClause, type SortClause, type Query, ModelQueryUtil } from '@travetto/model-query';
import { type IndexConfig, type ModelType, ModelRegistryIndex } from '@travetto/model';
import { DataUtil, SchemaRegistryIndex } from '@travetto/schema';

import { type EsSchemaConfig } from './types.ts';

/**
 * Support tools for dealing with elasticsearch specific requirements
 */
export class ElasticsearchQueryUtil {

  /**
   * Convert `a.b.c` to `a : { b : { c : ... }}`
   */
  static extractSimple<T>(input: T, path: string = ''): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const keys = TypedObject.keys(input);
    for (const key of keys) {
      const subPath = `${path}${key}`;
      if (DataUtil.isPlainObject(input[key]) && !Object.keys(input[key])[0].startsWith('$')) {
        Object.assign(out, this.extractSimple(input[key], `${subPath}.`));
      } else {
        out[subPath] = input[key];
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
    for (const key of Object.keys(simp)) {
      const translatedKey = key === 'id' ? '_id' : key;
      const value: 1 | 0 | boolean = castTo(simp[key]);
      if (value === 0 || value === false) {
        exclude.push(translatedKey);
      } else {
        include.push(translatedKey);
      }
    }
    return [include, exclude];
  }

  /**
   * Build sort mechanism
   */
  static getSort<T extends ModelType>(sort: SortClause<T>[] | IndexConfig<T>['fields']): estypes.Sort {
    return sort.map<estypes.SortOptions>(option => {
      const item = this.extractSimple(option);
      const key = Object.keys(item)[0];
      const value: boolean | -1 | 1 = castTo(item[key]);
      return { [key]: { order: value === 1 || value === true ? 'asc' : 'desc' } };
    });
  }

  /**
   * Extract specific term for a class, and a given field
   */
  static extractWhereTermQuery<T>(cls: Class<T>, item: Record<string, unknown>, config?: EsSchemaConfig, path: string = ''): Record<string, unknown> {
    const items = [];
    const fields = SchemaRegistryIndex.get(cls).getFields();

    for (const property of TypedObject.keys(item)) {
      const top = item[property];
      const declaredSchema = fields[property];
      const declaredType = declaredSchema.type;
      const subPath = declaredType === String ?
        ((property === 'id' && !path) ? '_id' : `${path}${property}`) :
        `${path}${property}`;

      const subPathQuery = (value: unknown): {} => (property === 'id' && !path) ?
        { ids: { values: Array.isArray(value) ? value : [value] } } :
        { [Array.isArray(value) ? 'terms' : 'term']: { [subPath]: value } };

      if (DataUtil.isPlainObject(top)) {
        const subKey = Object.keys(top)[0];
        if (!subKey.startsWith('$')) {
          const inner = this.extractWhereTermQuery(declaredType, top, config, `${subPath}.`);
          items.push(declaredSchema.array ?
            { nested: { path: subPath, query: inner } } :
            inner
          );
        } else {
          const value = top[subKey];

          switch (subKey) {
            case '$all': {
              const values = Array.isArray(value) ? value : [value];
              items.push({
                bool: {
                  must: values.map(term => ({ term: { [subPath]: term } }))
                }
              });
              break;
            }
            case '$in': {
              items.push(subPathQuery(Array.isArray(value) ? value : [value]));
              break;
            }
            case '$nin': {
              items.push({ bool: { ['must_not']: [subPathQuery(Array.isArray(value) ? value : [value])] } });
              break;
            }
            case '$eq': {
              items.push(subPathQuery(value));
              break;
            }
            case '$ne': {
              items.push({ bool: { ['must_not']: [subPathQuery(value)] } });
              break;
            }
            case '$exists': {
              const clause = { exists: { field: subPath } };
              items.push(value ? clause : { bool: { ['must_not']: clause } });
              break;
            }
            case '$lt':
            case '$gt':
            case '$gte':
            case '$lte': {
              const out: Record<string, unknown> = {};
              for (const key of Object.keys(top)) {
                out[key.replace(/^[$]/, '')] = ModelQueryUtil.resolveComparator(top[key]);
              }
              items.push({ range: { [subPath]: out } });
              break;
            }
            case '$regex': {
              const pattern = DataUtil.toRegex(castTo(value));
              if (pattern.source.startsWith('\\b') && pattern.source.endsWith('.*')) {
                const textField = !pattern.flags.includes('i') && config && config.caseSensitive ?
                  `${subPath}.text_cs` :
                  `${subPath}.text`;
                const query = pattern.source.substring(2, pattern.source.length - 2);
                items.push({
                  ['match_phrase_prefix']: {
                    [textField]: query
                  }
                });
              } else {
                items.push({ regexp: { [subPath]: pattern.source } });
              }
              break;
            }
            case '$geoWithin': {
              items.push({ ['geo_polygon']: { [subPath]: { points: value } } });
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
                  [subPath]: top.$near
                }
              });
              break;
            }
          }
        }
        // Handle operations
      } else {
        items.push(subPathQuery(top));
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
  static extractWhereQuery<T>(cls: Class<T>, clause: WhereClause<T>, config?: EsSchemaConfig): Record<string, unknown> {
    if (ModelQueryUtil.has$And(clause)) {
      return { bool: { must: clause.$and.map(item => this.extractWhereQuery<T>(cls, item, config)) } };
    } else if (ModelQueryUtil.has$Or(clause)) {
      return { bool: { should: clause.$or.map(item => this.extractWhereQuery<T>(cls, item, config)), ['minimum_should_match']: 1 } };
    } else if (ModelQueryUtil.has$Not(clause)) {
      return { bool: { ['must_not']: this.extractWhereQuery<T>(cls, clause.$not, config) } };
    } else {
      return this.extractWhereTermQuery(cls, clause, config);
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