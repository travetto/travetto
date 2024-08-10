import { Binary, ObjectId } from 'mongodb';

import { castTo, Class, TypedObject } from '@travetto/runtime';
import { DistanceUnit, ModelQuery, Query, WhereClause } from '@travetto/model-query';
import type { ModelType, IndexField } from '@travetto/model';
import { DataUtil, SchemaRegistry } from '@travetto/schema';
import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { AllViewⲐ } from '@travetto/schema/src/internal/types';

/**
 * Converting units to various radians
 */
const RADIANS_TO: Record<DistanceUnit, number> = {
  km: 6378,
  mi: 3963,
  m: 6378000,
  ft: 20924640,
  rad: 1
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithId<T> = T & { _id?: any };
const isWithId = <T extends ModelType>(o: T): o is WithId<T> => o && '_id' in o;

/**
 * Basic mongo utils for conforming to the model module
 */
export class MongoUtil {

  static toIndex<T extends ModelType>(f: IndexField<T>): Record<string, number> {
    const keys = [];
    while (typeof f !== 'number' && typeof f !== 'boolean' && Object.keys(f)) {
      const key = TypedObject.keys(f)[0];
      f = castTo(f[key]);
      keys.push(key);
    }
    const rf = castTo<number | boolean>(f);
    return {
      [keys.join('.')]: typeof rf === 'boolean' ? (rf ? 1 : 0) : rf
    };
  }

  static uuid(val: string): Binary {
    return new Binary(Buffer.from(val.replace(/-/g, ''), 'hex'), Binary.SUBTYPE_UUID);
  }

  static idToString(id: string | ObjectId | Binary): string {
    if (typeof id === 'string') {
      return id;
    } else if (id instanceof ObjectId) {
      return id.toHexString();
    } else {
      return Buffer.from(id.buffer).toString('hex');
    }
  }

  static async postLoadId<T extends ModelType>(item: T): Promise<T> {
    if (isWithId(item)) {
      delete item._id;
    }
    return item;
  }

  static preInsertId<T extends ModelType>(item: T): T {
    if (item && item.id) {
      const itemWithId = castTo<WithId<T>>(item);
      itemWithId._id = this.uuid(item.id);
    }
    return item;
  }

  static prepareQuery<T extends ModelType, U extends Query<T> | ModelQuery<T>>(cls: Class<T>, query: U, checkExpiry = true): {
    query: U & { where: WhereClause<T> };
    filter: Record<string, unknown>;
  } {
    const q = ModelQueryUtil.getQueryAndVerify(cls, query, checkExpiry);
    return {
      query: q,
      filter: q.where ? this.extractWhereClause(cls, q.where) : {}
    };
  }

  /**
   * Build mongo where clause
   */
  static extractWhereClause<T>(cls: Class<T>, o: WhereClause<T>): Record<string, unknown> {
    if (ModelQueryUtil.has$And(o)) {
      return { $and: o.$and.map(x => this.extractWhereClause<T>(cls, x)) };
    } else if (ModelQueryUtil.has$Or(o)) {
      return { $or: o.$or.map(x => this.extractWhereClause<T>(cls, x)) };
    } else if (ModelQueryUtil.has$Not(o)) {
      return { $nor: [this.extractWhereClause<T>(cls, o.$not)] };
    } else {
      return this.extractSimple(cls, o);
    }
  }

  /**
   * Convert ids from '_id' to 'id'
   */
  static replaceId(v: Record<string, unknown>): Record<string, Binary>;
  static replaceId(v: string[]): Binary[];
  static replaceId(v: string): Binary;
  static replaceId(v: unknown): undefined;
  static replaceId(v: string | string[] | Record<string, unknown> | unknown): unknown {
    if (typeof v === 'string') {
      return this.uuid(v);
    } else if (Array.isArray(v)) {
      return v.map(x => this.replaceId(x));
    } else if (DataUtil.isPlainObject(v)) {
      const out: Record<string, Binary> = {};
      for (const [k, el] of Object.entries(v)) {
        const found = this.replaceId(el);
        if (found) {
          out[k] = found;
        }
      }
      return out;
    } else {
      return v;
    }
  }

  /**/
  static extractSimple<T>(base: Class<T> | undefined, o: Record<string, unknown>, path: string = '', recursive: boolean = true): Record<string, unknown> {
    const schema = base ? SchemaRegistry.get(base) : undefined;
    const out: Record<string, unknown> = {};
    const sub = o;
    const keys = Object.keys(sub);
    for (const key of keys) {
      const subpath = `${path}${key}`;
      const v = castTo<Record<string, unknown>>(sub[key]);
      const subField = schema?.views[AllViewⲐ].schema[key];

      if (subpath === 'id') { // Handle ids directly
        out._id = this.replaceId(v);
      } else {
        const isPlain = v && DataUtil.isPlainObject(v);
        const firstKey = isPlain ? Object.keys(v)[0] : '';

        if ((isPlain && !firstKey.startsWith('$')) || v?.constructor?.Ⲑid) {
          if (recursive) {
            Object.assign(out, this.extractSimple(subField?.type, v, `${subpath}.`, recursive));
          } else {
            out[subpath] = v;
          }
        } else {
          if (firstKey === '$gt' || firstKey === '$lt' || firstKey === '$gte' || firstKey === '$lte') {
            for (const [sk, sv] of Object.entries(v)) {
              v[sk] = ModelQueryUtil.resolveComparator(sv);
            }
          } else if (firstKey === '$exists' && subField?.array) {
            const exists = v.$exists;
            if (!exists) {
              delete v.$exists;
              v.$in = [null, []];
            } else {
              v.$exists = true;
              v.$nin = [null, []];
            }
          } else if (firstKey === '$regex') {
            v.$regex = DataUtil.toRegex(castTo(v.$regex));
          } else if (firstKey && '$near' in v) {
            const dist = castTo<number>(v.$maxDistance);
            const distance = dist / RADIANS_TO[(castTo<DistanceUnit>(v.$unit) ?? 'km')];
            v.$maxDistance = distance;
            delete v.$unit;
          } else if (firstKey && '$geoWithin' in v) {
            const coords = castTo<[number, number][]>(v.$geoWithin);
            const first = coords[0];
            const last = coords[coords.length - 1];
            // Connect if not
            if (first[0] !== last[0] || first[1] !== last[1]) {
              coords.push(first);
            }
            v.$geoWithin = {
              $geometry: {
                type: 'Polygon',
                coordinates: [coords]
              }
            };
          }
          out[subpath] = v;
        }
      }
    }
    return out;
  }
}