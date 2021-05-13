import { Class } from '@travetto/base';

import { IndexNotSupported } from '../../error/invalid-index';
import { ModelRegistry } from '../../registry/model';
import { IndexConfig, SortClauseRaw } from '../../registry/types';
import { ModelType } from '../../types/model';

type Flattened = [field: string, dir: 1 | -1 | boolean];

type FlattenedConfig = Omit<IndexConfig<ModelType>, 'fields'> & { fields: Flattened[] };

/**
 * Utils for working with indexed model services
 */
export class ModelIndexedUtil {
  static #cache = new Map<string, FlattenedConfig>();

  /**
   * Project item via index
   * @param cls Type to get index for
   * @param idx Index config
   */
  static projectIndex<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item?: Partial<T>, emptyValue: unknown = null, emptySortValue: unknown = null) {
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    const res = {} as Record<string, unknown>;
    const sortField = cfg.type === 'sorted' ? cfg.fields[cfg.fields.length - 1] : undefined;
    for (const field of cfg.fields as Record<string, unknown>[]) {
      let o: Record<string, unknown> | undefined = item;
      let sub: Record<string, unknown> = res;
      const path: string[] = [];
      let f = field;

      while (sub !== undefined) {
        const k = Object.keys(f)[0];
        path.push(k);
        o = (o !== undefined ? o[k] : o) as Record<string, unknown> | undefined;
        if (typeof f[k] === 'boolean' || typeof f[k] === 'number') {
          if (o === undefined || o === null) {
            const empty = field === sortField ? emptySortValue : emptyValue;
            if (empty === Error) {
              throw new IndexNotSupported(cls, cfg, `Missing field value for ${path.join('.')}`);
            }
            o = empty as Record<string, unknown>;
          }
          sub[k] = o;
          break; // At the bottom
        } else {
          sub = (sub[k] ?? {}) as Record<string, unknown>;
          f = f[k] as Record<string, unknown>;
        }
      }
    }
    return res;
  }

  /**
   * Get flattened index
   * @param cls Type to get index for
   * @param idx Index config
   */
  static flattenIndex<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, separator = '.'): FlattenedConfig {
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    const key = `${cls.ᚕid}:${cfg.name}`;
    if (!this.#cache.has(key)) {
      const fields: [string, 1 | -1 | boolean][] = [];
      for (const el of cfg.fields) {
        let parts = [];
        let sub: SortClauseRaw<unknown> = el;
        for (; ;) {
          const subKey = Object.keys(sub)[0];
          parts.push(subKey);
          sub = sub[subKey as (keyof typeof sub)] as SortClauseRaw<unknown>;
          if (typeof sub === 'number' || typeof sub === 'boolean') {
            fields.push([parts.join(separator), sub as true]);
            parts = [];
            break;
          }
        }
      }
      this.#cache.set(key, { type: cfg.type, name: cfg.name, fields });
    }
    return this.#cache.get(key)!;
  }

  /**
   * Compute flattened field to value mappings
   * @param cls Class to get info for
   * @param idx Index config
   * @param item Item to read values from
   */
  static flattenIndexItem<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item: Partial<T>, separator = '.') {
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    return cfg.fields.map((f: SortClauseRaw<unknown>) => {
      let o = item as Record<string, unknown>;
      const parts = [];
      while (o !== undefined) {
        const k = Object.keys(f)[0];
        o = (o[k] as Record<string, unknown>);
        parts.push(k);
        const fk = k as (keyof typeof f);
        if (typeof f[fk] === 'boolean' || typeof f[fk] === 'number') {
          break; // At the bottom
        } else {
          f = f[fk];
        }
      }
      return [parts.join(separator), o] as [key: string, value: unknown];
    });
  }

  /**
   * Compute index key as a single value
   * @param cls Class to get index for
   * @param idx Index config
   * @param item item to process
   */
  static computeIndexParts<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item: Partial<T>) {
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    const parts: (string | boolean | Date | number)[] = [];
    const sortField = cfg.type === 'sorted' ? cfg.fields[cfg.fields.length - 1] : undefined;
    for (const f of cfg.fields) {
      let field: Record<string, unknown> = f;
      let o = item as Record<string, unknown>;
      const path = [];
      while (o !== undefined && o !== null) {
        const k = Object.keys(field)[0];
        path.push(k);
        o = o[k] as Record<string, unknown>;
        const fk = k as keyof typeof field;
        if (typeof field[fk] === 'boolean' || typeof field[fk] === 'number') {
          break; // At the bottom
        } else {
          field = field[fk] as Record<string, unknown>;
        }
      }
      if ((o === undefined || o === null) && f !== sortField) {
        throw new IndexNotSupported(cls, cfg, `Missing field value for ${path.join('.')}`);
      }
      parts.push(o as unknown as string | boolean | Date | number);
    }
    return parts;
  }

  /**
   * Compute index key as a single value
   * @param cls Class to get index for
   * @param idx Index config
   * @param item item to process
   */
  static computeIndexKey<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item: Partial<T>, separator = 'ᚕ') {
    const parts = this.computeIndexParts(cls, idx, item);
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    let sort: number | undefined;
    if (cfg.type === 'sorted') {
      const last = parts.pop();
      if (last) {
        sort = +last;
      }
    }
    const key = parts.map(x => `${x}`).join(separator);
    return cfg.type !== 'sorted' ? { type: cfg.type, key } : { type: cfg.type, key, sort };
  }
}