import { Class } from '@travetto/registry';
import { ModelRegistry } from '../../registry/registry';
import { IndexConfig } from '../../registry/types';
import { ModelType } from '../../types/model';

type Flattened = [field: string, dir: 1 | -1 | boolean];

type FlattenedConfig = Omit<IndexConfig<any>, 'fields'> & { fields: Flattened[] };

/**
 * Utils for working with indexed model services
 */
export class ModelIndexedUtil {
  private static _cache = new Map<string, FlattenedConfig>();

  /**
   * Project item via index
   * @param cls Type to get index for
   * @param idx Index config
   */
  static projectIndex<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item: Partial<T>, emptyValue = null) {
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    return cfg.fields.reduce((res: any, f: any) => {
      let o: any = item;
      let sub: any = res;

      while (sub !== undefined) {
        const k = Object.keys(f)[0];
        o = o !== undefined ? o[k] : o;
        if (typeof f[k] === 'boolean' || typeof f[k] === 'number') {
          sub[k] = o ?? emptyValue;
          break; // At the bottom
        } else {
          sub = sub[k] ?? {};
          f = f[k];
        }
      }
      return res;
    }, {} as any);
  }

  /**
   * Get flattened index
   * @param cls Type to get index for
   * @param idx Index config
   */
  static flattenIndex<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, separator = '.'): FlattenedConfig {
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    const key = `${cls.ᚕid}:${cfg.name}`;
    if (!this._cache.has(key)) {
      const fields: [string, 1 | -1 | boolean][] = [];
      for (const el of cfg.fields) {
        let parts = [];
        let sub: any = el;
        for (; ;) {
          const subKey = Object.keys(sub)[0];
          parts.push(subKey);
          sub = sub[subKey] as any;
          if (typeof sub === 'number' || typeof sub === 'boolean') {
            fields.push([parts.join(separator), sub as true]);
            parts = [];
            break;
          }
        }
      }
      this._cache.set(key, { unique: cfg.unique, name: cfg.name, fields });
    }
    return this._cache.get(key)!;
  }

  /**
   * Compute flattened field to value mappings
   * @param cls Class to get info for
   * @param idx Index config
   * @param item Item to read values from
   */
  static flattenIndexItem<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item: T, separator = '.') {
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    return cfg.fields.map((f: any) => {
      let o: any = item;
      const parts = [];
      while (o !== undefined) {
        const k = Object.keys(f)[0];
        o = o[k];
        parts.push(k);
        if (typeof f[k] === 'boolean' || typeof f[k] === 'number') {
          break; // At the bottom
        } else {
          f = f[k];
        }
      }
      return [parts.join(separator), o] as [key: string, value: any];
    });
  }


  /**
   * Compute index key as a single value
   * @param cls Class to get index for
   * @param idx Index config
   * @param item item to process
   */
  static computeIndexKey<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item: T, separator = 'ᚕ') {
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    return cfg.fields.map((f: any) => {
      let o: any = item;
      while (o !== undefined) {
        const k = Object.keys(f)[0];
        o = o[k];
        if (typeof f[k] === 'boolean' || typeof f[k] === 'number') {
          break; // At the bottom
        } else {
          f = f[k];
        }
      }
      return `${o}`;
    }).join(separator);
  }
}