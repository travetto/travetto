import { WhereClause } from '@travetto/model';
import { Class } from '@travetto/registry';
import { isPlainObject } from '@travetto/base';
import { SchemaRegistry } from '@travetto/schema';

const has$And = (o: any): o is ({ $and: WhereClause<any>[]; }) => '$and' in o;
const has$Or = (o: any): o is ({ $or: WhereClause<any>[]; }) => '$or' in o;
const has$Not = (o: any): o is ({ $not: WhereClause<any>; }) => '$not' in o;

export function extractWhereTermQuery<T>(o: any, cls: Class<T>, path: string = ''): any {
  const items = [];
  const schema = SchemaRegistry.getViewSchema(cls).schema;

  for (const key of Object.keys(o) as ((keyof (typeof o)))[]) {
    const top = o[key];
    const declaredType = schema[key].declared.type;
    const sPath = declaredType === String ? `${path}${key}.key` : `${path}${key}`;

    if (isPlainObject(top)) {
      const subKey = Object.keys(top)[0];
      if (!subKey.startsWith('$')) {
        items.push({
          nested: {
            path: sPath,
            query: extractWhereTermQuery(top, declaredType as Class<any>, `${sPath}.`)
          }
        });
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
          [declaredType === String ? `${path}${key}.key` : `${path}${key}`]: top
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

export function extractWhereQuery<T>(o: WhereClause<T>, cls: Class<T>): { [key: string]: any } {
  if (has$And(o)) {
    return { bool: { must: o.$and.map(x => extractWhereQuery<T>(x, cls)) } };
  } else if (has$Or(o)) {
    return { bool: { should: o.$or.map(x => extractWhereQuery<T>(x, cls)), minimum_should_match: 1 } };
  } else if (has$Not(o)) {
    return { bool: { must_not: extractWhereQuery<T>(o.$not, cls) } };
  } else {
    return extractWhereTermQuery(o, cls);
  }
}
