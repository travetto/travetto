import {
  Binary, type CreateIndexesOptions, type Filter, type FindCursor, type IndexDirection, ObjectId, type WithId as MongoWithId,
  type IndexDescriptionInfo
} from 'mongodb';

import { RuntimeError, CodecUtil, castTo, type Class, toConcrete, TypedObject, BinaryUtil } from '@travetto/runtime';
import { type DistanceUnit, type PageableModelQuery, type WhereClause, ModelQueryUtil } from '@travetto/model-query';
import type { ModelType, IndexField, IndexConfig } from '@travetto/model';
import { DataUtil, SchemaRegistryIndex, type Point } from '@travetto/schema';

const PointConcrete = toConcrete<Point>();

type IdxConfig = CreateIndexesOptions;

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

  static namespaceIndex(cls: Class, name: string): string {
    return `${cls.Ⲑid}__${name}`.replace(/[^a-zA-Z0-9_]+/g, '_');
  }

  static toIndex<T extends ModelType>(field: IndexField<T>): PlainIdx {
    const keys = [];
    while (typeof field !== 'number' && typeof field !== 'boolean' && Object.keys(field)) {
      const key = TypedObject.keys(field)[0];
      field = castTo(field[key]);
      keys.push(key);
    }
    const rf: number | boolean = castTo(field);
    return {
      [keys.join('.')]: typeof rf === 'boolean' ? (rf ? 1 : 0) : castTo<-1 | 1 | 0>(rf)
    };
  }

  static uuid(value: string): Binary {
    return new Binary(
      BinaryUtil.binaryArrayToBuffer(
        CodecUtil.fromHexString(value.replaceAll('-', ''))
      ),
      Binary.SUBTYPE_UUID
    );
  }

  static idToString(id: string | ObjectId | Binary): string {
    if (typeof id === 'string') {
      return id;
    } else if (id instanceof ObjectId) {
      return id.toHexString();
    } else {
      return CodecUtil.toHexString(id.buffer);
    }
  }

  static extractWhereFilter<T extends ModelType, U extends WhereClause<T>>(cls: Class<T>, where?: U, checkExpiry = true): Filter<T> {
    where = castTo(ModelQueryUtil.getWhereClause(cls, where, checkExpiry));
    return castTo(where ? this.extractWhereClause(cls, where) : {});
  }

  /**
   * Build mongo where clause
   */
  static extractWhereClause<T>(cls: Class<T>, clause: WhereClause<T>): Record<string, unknown> {
    if (ModelQueryUtil.has$And(clause)) {
      return { $and: clause.$and.map(item => this.extractWhereClause<T>(cls, item)) };
    } else if (ModelQueryUtil.has$Or(clause)) {
      return { $or: clause.$or.map(item => this.extractWhereClause<T>(cls, item)) };
    } else if (ModelQueryUtil.has$Not(clause)) {
      return { $nor: [this.extractWhereClause<T>(cls, clause.$not)] };
    } else {
      return this.extractSimple(cls, clause);
    }
  }

  /**/
  static extractSimple<T>(base: Class<T> | undefined, item: Record<string, unknown>, path: string = '', recursive: boolean = true): Record<string, unknown> {
    const fields = base ? SchemaRegistryIndex.getOptional(base)?.getFields() : undefined;
    const out: Record<string, unknown> = {};
    const sub = item;
    const keys = Object.keys(sub);
    for (const key of keys) {
      const subpath = `${path}${key}`;
      const value: Record<string, unknown> = castTo(sub[key]);
      const subField = fields?.[key];

      const isPlain = value && DataUtil.isPlainObject(value);
      const firstKey = isPlain ? Object.keys(value)[0] : '';

      if (subpath === 'id') {
        if (!firstKey) {
          out._id = Array.isArray(value) ? value.map(subValue => this.uuid(subValue)) : this.uuid(`${value}`);
        } else if (firstKey === '$in' || firstKey === '$nin' || firstKey === '$eq' || firstKey === '$ne') {
          const temp = value[firstKey];
          out._id = { [firstKey]: Array.isArray(temp) ? temp.map(subValue => this.uuid(subValue)) : this.uuid(`${temp}`) };
        } else {
          throw new RuntimeError('Invalid id query');
        }
      } else if ((isPlain && !firstKey.startsWith('$')) || value?.constructor?.Ⲑid) {
        if (recursive) {
          Object.assign(out, this.extractSimple(subField?.type, value, `${subpath}.`, recursive));
        } else {
          out[subpath] = value;
        }
      } else {
        if (firstKey === '$gt' || firstKey === '$lt' || firstKey === '$gte' || firstKey === '$lte') {
          for (const [sk, sv] of Object.entries(value)) {
            value[sk] = ModelQueryUtil.resolveComparator(sv);
          }
        } else if (firstKey === '$exists' && subField?.array) {
          const exists = value.$exists;
          if (!exists) {
            delete value.$exists;
            value.$in = [null, []];
          } else {
            value.$exists = true;
            value.$nin = [null, []];
          }
        } else if (firstKey === '$regex') {
          value.$regex = DataUtil.toRegex(castTo(value.$regex));
        } else if (firstKey && '$near' in value) {
          const dist: number = castTo(value.$maxDistance);
          const distance = dist / RADIANS_TO[(castTo<DistanceUnit>(value.$unit) ?? 'km')];
          value.$maxDistance = distance;
          delete value.$unit;
        } else if (firstKey && '$geoWithin' in value) {
          const coords: [number, number][] = castTo(value.$geoWithin);
          const first = coords[0];
          const last = coords.at(-1)!;
          // Connect if not
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push(first);
          }
          value.$geoWithin = {
            $geometry: {
              type: 'Polygon',
              coordinates: [coords]
            }
          };
        }
        out[subpath === 'id' ? '_id' : subpath] = value;
      }
    }
    return out;
  }

  static getExtraIndices<T extends ModelType>(cls: Class<T>): [BasicIdx, IdxConfig][] {
    const out: [BasicIdx, IdxConfig][] = [];
    const textFields: string[] = [];
    SchemaRegistryIndex.visitFields(cls, (field, path) => {
      if (field.type === PointConcrete) {
        const name = [...path, field].map(schema => schema.name).join('.');
        out.push([{ [name]: '2d' }, { name: this.namespaceIndex(cls, name) }]);
      } else if (field.specifiers?.includes('text') && (field.specifiers?.includes('long') || field.specifiers.includes('search'))) {
        const name = [...path, field].map(schema => schema.name).join('.');
        textFields.push(name);
      }
    });
    if (textFields.length) {
      const text: BasicIdx = Object.fromEntries(textFields.map(field => [field, 'text']));
      out.push([text, { name: this.namespaceIndex(cls, 'text_search') }]);
    }
    return out;
  }

  static getPlainIndex(idx: IndexConfig<ModelType>): PlainIdx {
    let out: PlainIdx = {};
    for (const config of idx.fields.map(value => this.toIndex(value))) {
      out = Object.assign(out, config);
    }
    return out;
  }

  static getIndices<T extends ModelType>(cls: Class<T>, indices: IndexConfig<ModelType>[] = []): [BasicIdx, IdxConfig][] {
    return [
      ...indices.map(idx => [this.getPlainIndex(idx), { ...(idx.type === 'unique' ? { unique: true } : {}), name: this.namespaceIndex(cls, idx.name) }] as const),
      ...this.getExtraIndices(cls)
    ].map(idx => [...idx]);
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
      cursor = cursor.sort(Object.assign({}, ...query.sort.map(item => this.extractSimple(cls, item))));
    }

    cursor = cursor.limit(Math.trunc(query.limit ?? 200));

    if (query.offset && typeof query.offset === 'number') {
      cursor = cursor.skip(Math.trunc(query.offset ?? 0));
    }

    return castTo(cursor);
  }

  static isIndexChanged(existing: IndexDescriptionInfo, [pendingKey, pendingOptions]: [BasicIdx, CreateIndexesOptions]): boolean {
    let changed = false;
    // Config changed
    changed ||=
      !!existing.unique !== !!pendingOptions.unique ||
      !!existing.sparse !== !!pendingOptions.sparse ||
      existing.expireAfterSeconds !== pendingOptions.expireAfterSeconds ||
      existing.bucketSize !== pendingOptions.bucketSize;

    const existingFields = existing.textIndexVersion ?
      Object.fromEntries(Object.entries(existing.weights ?? {}).map(([key]) => [key, 'text'])) :
      existing.key;

    const pendingKeySet = new Set(Object.keys(pendingKey));
    const existingKeySet = new Set(Object.keys(existingFields));

    changed ||= pendingKeySet.size !== existingKeySet.size;

    const overlap = [...pendingKeySet.intersection(existingKeySet)];
    changed ||= overlap.length !== pendingKeySet.size;

    for (let i = 0; i < overlap.length && !changed; i++) {
      changed ||= existingFields[overlap[i]] !== pendingKey[overlap[i]];
    }

    return changed;
  }
}