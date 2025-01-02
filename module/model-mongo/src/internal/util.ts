import {
  Binary, type CreateIndexesOptions, type Filter, type FindCursor, type IndexDirection, ObjectId, type WithId as MongoWithId
} from 'mongodb';

import { castTo, Class, TypedObject } from '@travetto/runtime';
import { DistanceUnit, PageableModelQuery, WhereClause } from '@travetto/model-query';
import type { ModelType, IndexField, IndexConfig, OptionalId } from '@travetto/model';
import { DataUtil, SchemaRegistry } from '@travetto/schema';
import { ModelQueryUtil } from '@travetto/model-query/src/internal/service/query';
import { AllViewⲐ } from '@travetto/schema/src/internal/types';
import { PointImpl } from '@travetto/model-query/src/internal/model/point';

type IdxCfg = CreateIndexesOptions;

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

export type WithId<T, I = unknown> = T & { _id?: I };
export type BasicIdx = Record<string, IndexDirection>;
export type PlainIdx = Record<string, -1 | 0 | 1>;

/**
 * Basic mongo utils for conforming to the model module
 */
export class MongoUtil {

  static toIndex<T extends ModelType>(f: IndexField<T>): PlainIdx {
    const keys = [];
    while (typeof f !== 'number' && typeof f !== 'boolean' && Object.keys(f)) {
      const key = TypedObject.keys(f)[0];
      f = castTo(f[key]);
      keys.push(key);
    }
    const rf: number | boolean = castTo(f);
    return {
      [keys.join('.')]: typeof rf === 'boolean' ? (rf ? 1 : 0) : castTo<-1 | 1 | 0>(rf)
    };
  }

  static uuid(val: string): Binary {
    return new Binary(Buffer.from(val.replaceAll('-', ''), 'hex'), Binary.SUBTYPE_UUID);
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

  static postLoadDoc<T extends ModelType>(item: T & { _id?: unknown }): T {
    if (item._id) {
      item.id = this.idToString(castTo(item._id));
      delete item._id;
    }
    return item;
  }

  static preUpdateDoc<T extends OptionalId<ModelType>>(item: T): T {
    if (item && item.id) {
      const itemWithId: WithId<T> = castTo(item);
      itemWithId._id = this.uuid(item.id);
      delete castTo<{ id: undefined }>(itemWithId).id;
    }
    return item;
  }

  static extractWhereFilter<T extends ModelType, U extends WhereClause<T>>(cls: Class<T>, where?: U, checkExpiry = true): Filter<T> {
    where = castTo(ModelQueryUtil.getWhereClause(cls, where, checkExpiry));
    return castTo(where ? this.extractWhereClause(cls, where) : {});
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

  /**/
  static extractSimple<T>(base: Class<T> | undefined, o: Record<string, unknown>, path: string = '', recursive: boolean = true): Record<string, unknown> {
    const schema = base ? SchemaRegistry.get(base) : undefined;
    const out: Record<string, unknown> = {};
    const sub = o;
    const keys = Object.keys(sub);
    for (const key of keys) {
      const subpath = `${path}${key}`;
      const v: Record<string, unknown> = castTo(sub[key]);
      const subField = schema?.views[AllViewⲐ].schema[key];

      if (subpath === 'id') { // Handle ids directly
        out._id = typeof v === 'string' ? this.uuid(v) : v;
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
            const dist: number = castTo(v.$maxDistance);
            const distance = dist / RADIANS_TO[(castTo<DistanceUnit>(v.$unit) ?? 'km')];
            v.$maxDistance = distance;
            delete v.$unit;
          } else if (firstKey && '$geoWithin' in v) {
            const coords: [number, number][] = castTo(v.$geoWithin);
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

  static getExtraIndices<T extends ModelType>(cls: Class<T>): BasicIdx[] {
    const out: BasicIdx[] = [];
    const textFields: string[] = [];
    SchemaRegistry.visitFields(cls, (field, path) => {
      if (field.type === PointImpl) {
        const name = [...path, field].map(x => x.name).join('.');
        out.push({ [name]: '2d' });
      } else if (field.specifiers?.includes('text') && (field.specifiers?.includes('long') || field.specifiers.includes('search'))) {
        const name = [...path, field].map(x => x.name).join('.');
        textFields.push(name);
      }
    });
    if (textFields.length) {
      const text: BasicIdx = {};
      for (const field of textFields) {
        text[field] = 'text';
      }
      out.push(text);
    }
    return out;
  }

  static getPlainIndex(idx: IndexConfig<ModelType>): PlainIdx {
    let out: PlainIdx = {};
    for (const cfg of idx.fields.map(x => this.toIndex(x))) {
      out = Object.assign(out, cfg);
    }
    return out;
  }

  static getIndices<T extends ModelType>(cls: Class<T>, indices: IndexConfig<ModelType>[] = []): [BasicIdx, IdxCfg][] {
    return [
      ...indices.map(idx => [this.getPlainIndex(idx), (idx.type === 'unique' ? { unique: true } : {})] as const),
      ...this.getExtraIndices(cls).map((x) => [x, {}] as const)
    ].map(x => [...x]);
  }

  static prepareCursor<T extends ModelType>(cls: Class<T>, cursor: FindCursor<T | MongoWithId<T>>, query: PageableModelQuery<T>): FindCursor<T> {
    if (query.select) {
      const selectKey = Object.keys(query.select)[0];
      const select = typeof selectKey === 'string' && selectKey.startsWith('$') ? query.select : this.extractSimple(cls, query.select);
      // Remove id if not explicitly defined, and selecting fields directly
      if (!select['_id']) {
        const values = new Set([...Object.values(select)]);
        if (values.has(1) || values.has(true)) {
          select['_id'] = false;
        }
      }
      cursor.project(select);
    }

    if (query.sort) {
      cursor = cursor.sort(Object.assign({}, ...query.sort.map(x => this.extractSimple(cls, x))));
    }

    cursor = cursor.limit(Math.trunc(query.limit ?? 200));

    if (query.offset && typeof query.offset === 'number') {
      cursor = cursor.skip(Math.trunc(query.offset ?? 0));
    }

    return castTo(cursor);
  }
}