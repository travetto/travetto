import * as mongo from 'mongodb';

import { Class, Util } from '@travetto/base';
import { DistanceUnit, WhereClause } from '@travetto/model-query';
import { ModelRegistry } from '@travetto/model/src/registry/model';
import { QueryLanguageParser } from '@travetto/model-query/src/internal/query/parser';

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

/**
 * Basic mongo utils for conforming to the model module
 */
export class MongoUtil {

  static has$And = (o: unknown): o is ({ $and: WhereClause<unknown>[] }) => !!o && '$and' in (o as object);
  static has$Or = (o: unknown): o is ({ $or: WhereClause<unknown>[] }) => !!o && '$or' in (o as object);
  static has$Not = (o: unknown): o is ({ $not: WhereClause<unknown> }) => !!o && '$not' in (o as object);

  /**
   * Get a where clause with type
   */
  static getWhereClause<T>(cls: Class<T>, o: WhereClause<T> | string | undefined): WhereClause<T> {
    let q = o ? (typeof o === 'string' ? QueryLanguageParser.parseToQuery(o) as WhereClause<T> : o) : {};

    const conf = ModelRegistry.get(cls);
    if (conf.subType) {
      q = { $and: [q, { type: conf.subType }] };
    }
    return q;
  }

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
  static replaceId(v: Record<string, string>): Record<string, mongo.ObjectId>;
  static replaceId(v: string[]): mongo.ObjectId[];
  static replaceId(v: string): mongo.ObjectId;
  static replaceId(v: string | string[] | Record<string, string>) {
    if (typeof v === 'string') {
      return new mongo.ObjectId(v);
    } else if (Array.isArray(v)) {
      return v.map(x => this.replaceId(x));
    } else if (Util.isPlainObject(v)) {
      const out: Record<string, unknown> = {};
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
  static extractSimple<T>(o: T, path: string = ''): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const sub = o as Record<string, unknown>;
    const keys = Object.keys(sub);
    for (const key of keys) {
      const subpath = `${path}${key}`;
      const v = sub[key] as Record<string, unknown>;

      if (subpath === 'id') { // Handle ids directly
        out._id = this.replaceId(v as Record<string, string>);
      } else {
        const isPlain = v && Util.isPlainObject(v);
        const firstKey = isPlain ? Object.keys(v)[0] : '';
        if ((isPlain && !firstKey.startsWith('$')) || v?.constructor?.ᚕid) {
          Object.assign(out, this.extractSimple(v, `${subpath}.`));
        } else {
          if (firstKey === '$regex') {
            v.$regex = Util.toRegex(v.$regex as string | RegExp);
          } else if (firstKey && '$near' in v) {
            const dist = v.$maxDistance as number;
            const distance = dist / RADIANS_TO[(v.$unit as DistanceUnit ?? 'km')];
            v.$maxDistance = distance;
            delete v.$unit;
          } else if (firstKey && '$geoWithin' in v) {
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