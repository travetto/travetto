import * as mongo from 'mongodb';

import { Class, Util } from '@travetto/base';
import { DistanceUnit, ModelQuery, Query, WhereClause } from '@travetto/model-query';
import { ModelType } from '@travetto/model';
import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { IndexField } from '@travetto/model/src/registry/types';

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

export type WithId<T> = T & { _id?: mongo.Binary };
const isWithId = <T extends ModelType>(o: T): o is WithId<T> => o && '_id' in o;


/**
 * Basic mongo utils for conforming to the model module
 */
export class MongoUtil {

  static toIndex<T extends ModelType>(f: IndexField<T>): Record<string, number> {
    const keys = [];
    while (typeof f !== 'number' && typeof f !== 'boolean' && Object.keys(f)) {
      const key = Object.keys(f)[0];
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      f = f[key as keyof typeof f] as IndexField<T>;
      keys.push(key);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const rf = f as unknown as (number | boolean);
    return {
      [keys.join('.')]: typeof rf === 'boolean' ? (rf ? 1 : 0) : rf
    };
  }

  static uuid(val: string): mongo.Binary {
    return new mongo.Binary(Buffer.from(val.replace(/-/g, ''), 'hex'), mongo.Binary.SUBTYPE_UUID);
  }

  static idToString(id: string | mongo.ObjectId | mongo.Binary): string {
    if (typeof id === 'string') {
      return id;
    } else if (id instanceof mongo.ObjectId) {
      return id.toHexString();
    } else {
      return id.buffer.toString('hex');
    }
  }

  static async postLoadId<T extends ModelType>(item: T): Promise<T> {
    if (isWithId(item)) {
      item.id = this.idToString(item._id!);
      delete item._id;
    }
    return item;
  }

  static preInsertId<T extends ModelType>(item: T): T {
    if (item && item.id) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const itemWithId = item as WithId<T>;
      itemWithId._id = this.uuid(item.id);
      // @ts-expect-error
      delete item.id;
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
      filter: q.where ? this.extractWhereClause(q.where) : {}
    };
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  static has$And = (o: unknown): o is ({ $and: WhereClause<unknown>[] }) => !!o && '$and' in (o as object);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  static has$Or = (o: unknown): o is ({ $or: WhereClause<unknown>[] }) => !!o && '$or' in (o as object);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  static has$Not = (o: unknown): o is ({ $not: WhereClause<unknown> }) => !!o && '$not' in (o as object);

  /**
   * Build mongo where clause
   */
  static extractWhereClause<T>(o: WhereClause<T>): Record<string, unknown> {
    if (this.has$And(o)) {
      return { $and: o.$and.map(x => this.extractWhereClause<T>(x)) };
    } else if (this.has$Or(o)) {
      return { $or: o.$or.map(x => this.extractWhereClause<T>(x)) };
    } else if (this.has$Not(o)) {
      return { $nor: [this.extractWhereClause<T>(o.$not)] };
    } else {
      return this.extractSimple(o);
    }
  }

  /**
   * Convert ids from '_id' to 'id'
   */
  static replaceId(v: Record<string, unknown>): Record<string, mongo.Binary>;
  static replaceId(v: string[]): mongo.Binary[];
  static replaceId(v: string): mongo.Binary;
  static replaceId(v: unknown): undefined;
  static replaceId(v: string | string[] | Record<string, unknown> | unknown): unknown {
    if (typeof v === 'string') {
      return this.uuid(v);
    } else if (Array.isArray(v)) {
      return v.map(x => this.replaceId(x));
    } else if (Util.isPlainObject(v)) {
      const out: Record<string, mongo.Binary> = {};
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

  /**
   * Convert `'a.b.c'` to `{ a: { b: { c: ... }}}`
   */
  static extractSimple<T>(o: T, path: string = ''): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sub = o as Record<string, unknown>;
    const keys = Object.keys(sub);
    for (const key of keys) {
      const subpath = `${path}${key}`;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const v = sub[key] as Record<string, unknown>;

      if (subpath === 'id') { // Handle ids directly
        out._id = this.replaceId(v);
      } else {
        const isPlain = v && Util.isPlainObject(v);
        const firstKey = isPlain ? Object.keys(v)[0] : '';
        if ((isPlain && !firstKey.startsWith('$')) || v?.constructor?.Ⲑid) {
          Object.assign(out, this.extractSimple(v, `${subpath}.`));
        } else {
          if (firstKey === '$gt' || firstKey === '$lt' || firstKey === '$gte' || firstKey === '$lte') {
            for (const [sk, sv] of Object.entries(v)) {
              v[sk] = ModelQueryUtil.resolveComparator(sv);
            }
          } else if (firstKey === '$regex') {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            v.$regex = Util.toRegex(v.$regex as string | RegExp);
          } else if (firstKey && '$near' in v) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const dist = v.$maxDistance as number;
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const distance = dist / RADIANS_TO[(v.$unit as DistanceUnit ?? 'km')];
            v.$maxDistance = distance;
            delete v.$unit;
          } else if (firstKey && '$geoWithin' in v) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const coords = v.$geoWithin as [number, number][];
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