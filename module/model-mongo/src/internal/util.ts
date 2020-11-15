import * as mongo from 'mongodb';

// import {
//   WhereClause,
//   ModelRegistry,
//   DistanceUnit
// } from '@travetto/model';

import { Class } from '@travetto/registry';
import { Util } from '@travetto/base';

/**
 * Converting units to various radians
 */
// const RADIANS_TO: Record<DistanceUnit, number> = {
//   km: 6378,
//   mi: 3963,
//   m: 6378000,
//   ft: 20924640,
//   rad: 1
// };

/**
 * Basic mongo utils for conforming to the model module
 */
export class MongoUtil {

  // static has$And = (o: any): o is ({ $and: WhereClause<any>[] }) => '$and' in o;
  // static has$Or = (o: any): o is ({ $or: WhereClause<any>[] }) => '$or' in o;
  // static has$Not = (o: any): o is ({ $not: WhereClause<any> }) => '$not' in o;

  // /**
  //  * Get a where clause with type
  //  */
  // static extractTypedWhereClause<T>(cls: Class<T>, o: WhereClause<T>): Record<string, any> {
  //   const conf = ModelRegistry.get(cls);
  //   if (conf.subType) {
  //     o = { $and: [o, { type: conf.subType }] } as WhereClause<T>;
  //   }
  //   return this.extractWhereClause(o);
  // }

  // /**
  //  * Build mongo where clause
  //  */
  // static extractWhereClause<T>(o: WhereClause<T>): Record<string, any> {
  //   if (this.has$And(o)) {
  //     return { $and: o.$and.map(x => this.extractWhereClause<T>(x)) };
  //   } else if (this.has$Or(o)) {
  //     return { $or: o.$or.map(x => this.extractWhereClause<T>(x)) };
  //   } else if (this.has$Not(o)) {
  //     return { $nor: [this.extractWhereClause<T>(o.$not)] };
  //   } else {
  //     return this.extractSimple(o);
  //   }
  // }

  /**
   * Convert ids from '_id' to 'id'
   */
  static replaceId(v: Record<string, string>): Record<string, mongo.ObjectId>;
  static replaceId(v: string[]): mongo.ObjectId[];
  static replaceId(v: string): mongo.ObjectId;
  static replaceId(v: string | string[] | Record<string, string>) {
    if (typeof v === 'string') {
      return new mongo.ObjectId(v);
    } else if (Array.isArray(v)) {
      return v.map(x => this.replaceId(x));
    } else if (Util.isPlainObject(v)) {
      const out: any = {};
      for (const k of Object.keys(v)) {
        out[k] = this.replaceId(v[k]);
      }
      return out;
    } else {
      return v;
    }
  }

  /**
   * Convert `'a.b.c'` to `{ a: { b: { c: ... }}}`
   */
  static extractSimple<T>(o: T, path: string = ''): Record<string, any> {
    const out: Record<string, any> = {};
    const sub = o as Record<string, any>;
    const keys = Object.keys(sub);
    for (const key of keys) {
      const subpath = `${path}${key}`;
      const v = sub[key];

      if (subpath === 'id') { // Handle ids directly
        out._id = this.replaceId(v);
      } else {
        const isPlain = v && Util.isPlainObject(v);
        const firstKey = isPlain ? Object.keys(v)[0] : '';
        if ((isPlain && !firstKey.startsWith('$')) || v?.constructor?.ᚕid) {
          Object.assign(out, this.extractSimple(v, `${subpath}.`));
        } else {
          if (firstKey === '$regex') {
            v.$regex = Util.toRegex(v.$regex);
          } else if (firstKey && '$near' in v) {
            // const dist = v.$maxDistance;
            // const distance = dist / RADIANS_TO[(v.$unit as DistanceUnit ?? 'km')];
            // v.$maxDistance = distance;
            // delete v.$unit;
          } else if (firstKey && '$geoWithin' in v) {
            const coords = v.$geoWithin;
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