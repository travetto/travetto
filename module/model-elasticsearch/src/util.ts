import { Util } from '@travetto/base';
import { WhereClause, SelectClause } from '@travetto/model';
import { Class } from '@travetto/registry';
import { SchemaRegistry } from '@travetto/schema';

const has$And = (o: any): o is ({ $and: WhereClause<any>[]; }) => '$and' in o;
const has$Or = (o: any): o is ({ $or: WhereClause<any>[]; }) => '$or' in o;
const has$Not = (o: any): o is ({ $not: WhereClause<any>; }) => '$not' in o;

export class ElasticsearchUtil {

  static extractSimple<T>(o: T, path: string = ''): { [key: string]: any } {
    const out: { [key: string]: any } = {};
    const sub = o as { [key: string]: any };
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

  static getSelect<T>(clause: SelectClause<T>) {
    const simp = ElasticsearchUtil.extractSimple(clause);
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

  static extractWhereTermQuery<T>(o: { [key: string]: any }, cls: Class<T>, path: string = ''): any {
    const items = [];
    const schema = SchemaRegistry.getViewSchema(cls).schema;

    for (const key of Object.keys(o) as ((keyof (typeof o)))[]) {
      const top = o[key];
      const declaredSchema = schema[key];
      const declaredType = declaredSchema.type;
      const sPath = declaredType === String ?
        (key === 'id' ? `${path}_${key}` : `${path}${key}.raw`) :
        `${path}${key}`;

      if (Util.isPlainObject(top)) {
        const subKey = Object.keys(top)[0];
        if (!subKey.startsWith('$')) {
          const inner = this.extractWhereTermQuery(top, declaredType as Class<any>, `${sPath}.`);
          items.push(
            declaredSchema.array ?
              { nested: { path: sPath, query: inner } } :
              inner
          );
        } else {
          const v = top[subKey];

          switch (subKey) {
            case '$all':
              const arr = Array.isArray(v) ? v : [v];
              items.push({
                terms_set: {
                  [sPath]: {
                    terms: arr,
                    minimum_should_match: arr.length
                  }
                }
              });
              break;
            case '$in':
              items.push({ terms: { [sPath]: Array.isArray(v) ? v : [v] } });
              break;
            case '$nin':
              items.push({
                bool: { must_not: [{ terms: { [sPath]: Array.isArray(v) ? v : [v] } }] }
              });
              break;
            case '$eq':
              items.push({ term: { [sPath]: v } });
              break;
            case '$ne':
              items.push({
                bool: { must_not: [{ term: { [sPath]: v } }] }
              });
              break;
            case '$exists':
              const q = {
                exists: {
                  field: sPath
                }
              };
              items.push(v ? q : {
                bool: {
                  must_not: q
                }
              });
              break;
            case '$lt':
            case '$gt':
            case '$gte':
            case '$lte':
              const out: any = {};
              for (const k of Object.keys(top)) {
                out[k.replace(/^[$]/, '')] = top[k];
              }
              items.push({
                range: {
                  [sPath]: out
                }
              });
              break;
            case '$regex':
              items.push({
                regexp: {
                  [sPath]: typeof v === 'string' ? v : `${v.source}`
                }
              });
              break;
            case '$geoWithin':
              items.push({
                geo_polygon: {
                  [sPath]: {
                    points: v.map(([lat, lon]: [number, number]) => ({ lat, lon }))
                  }
                }
              });
              break;
            case '$geoIntersects':
              items.push({
                geo_shape: {
                  [sPath]: {
                    type: 'envelope',
                    coordinates: v
                  },
                  relation: 'within'
                }
              });
              break;
          }
        }
        // Handle operations
      } else {
        items.push({
          [Array.isArray(top) ? 'terms' : 'term']: {
            [declaredType === String ? (key !== 'id' ? `${path}${key}.raw` : `${path}_${key}`) : `${path}${key}`]: top
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

  static extractWhereQuery<T>(o: WhereClause<T>, cls: Class<T>): { [key: string]: any } {
    if (has$And(o)) {
      return { bool: { must: o.$and.map(x => this.extractWhereQuery<T>(x, cls)) } };
    } else if (has$Or(o)) {
      return { bool: { should: o.$or.map(x => this.extractWhereQuery<T>(x, cls)), minimum_should_match: 1 } };
    } else if (has$Not(o)) {
      return { bool: { must_not: this.extractWhereQuery<T>(o.$not, cls) } };
    } else {
      return this.extractWhereTermQuery(o, cls);
    }
  }

  static generateSourceSchema<T>(cls: Class<T>): any {
    const schema = SchemaRegistry.getViewSchema(cls);

    const props: any = {};

    for (const field of schema.fields) {
      const conf = schema.schema[field];

      if (conf.type === Number) {
        let prop: any = { type: 'integer' };
        if (conf.precision) {
          const [digits, decimals] = conf.precision;
          if (decimals) {
            if ((decimals + digits) < 16) {
              prop = { type: 'scaled_float', scaling_factor: decimals };
            } else {
              if (digits < 6 && decimals < 9) {
                prop = { type: 'half_float' };
              } else if (digits > 20) {
                prop = { type: 'double' };
              } else {
                prop = { type: 'float' };
              }
            }
          }
        }
        props[field] = prop;
      } else if (conf.type === Date) {
        props[field] = { type: 'date', format: 'date_optional_time' };
      } else if (conf.type === Boolean) {
        props[field] = { type: 'boolean' };
      } else if (conf.type === String) {
        props[field] = {
          type: 'text',
          fields: {
            raw: {
              type: 'keyword'
            }
          }
        };
      } else if (conf.type === Object) {
        props[field] = { type: 'object', dynamic: true };
      } else if (SchemaRegistry.has(conf.type)) {
        props[field] = {
          type: conf.array ? 'nested' : 'object',
          ...this.generateSourceSchema(conf.type)
        };
      }
    }

    return { properties: props, dynamic: false };
  }
}