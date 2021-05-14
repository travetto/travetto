import { Class } from '@travetto/base';

import { IndexNotSupported } from '../../error/invalid-index';
import { ModelRegistry } from '../../registry/model';
import { IndexConfig } from '../../registry/types';
import { ModelType } from '../../types/model';

type ComputeConfig = {
  includeSortInFields?: boolean;
  emptyValue?: unknown;
  emptySortValue?: unknown;
};

/**
 * Utils for working with indexed model services
 */
export class ModelIndexedUtil {

  /**
   * Compute flattened field to value mappings
   * @param cls Class to get info for
   * @param idx Index config
   * @param item Item to read values from
   */
  static computeIndexParts<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item: Partial<T>, opts: ComputeConfig = {}) {
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    const sortField = cfg.type === 'sorted' ? cfg.fields[cfg.fields.length - 1] : undefined;

    const fields: { path: string[], value: (string | boolean | Date | number) }[] = [];
    let sortDir: number = 0;
    let sorted: { path: string[], dir: number, value: number | Date } | undefined;

    for (const field of cfg.fields) {
      let f = field as Record<string, unknown>;
      let o = item as Record<string, unknown>;
      const parts = [];

      while (o !== undefined && o !== null) {
        const k = Object.keys(f)[0];
        o = (o[k] as Record<string, unknown>);
        parts.push(k);
        const fk = k as (keyof typeof f);
        if (typeof f[fk] === 'boolean' || typeof f[fk] === 'number') {
          if (cfg.type === 'sorted') {
            sortDir = f[fk] === true ? 1 : f[fk] as number;
          }
          break; // At the bottom
        } else {
          f = f[fk] as Record<string, unknown>;
        }
      }
      if (field === sortField) {
        sorted = { path: parts, dir: sortDir, value: o as unknown as number | Date };
      }
      if (o === undefined || o === null) {
        const empty = field === sortField ? opts.emptySortValue : opts.emptyValue;
        if (empty === undefined || empty === Error) {
          throw new IndexNotSupported(cls, cfg, `Missing field value for ${parts.join('.')}`);
        }
        o = empty as Record<string, unknown>;
      } else {
        if (field !== sortField || (opts.includeSortInFields ?? true)) {
          fields.push({ path: parts, value: o as unknown as string | boolean | Date | number });
        }
      }
    }

    return { fields, sorted };
  }


  /**
   * Project item via index
   * @param cls Type to get index for
   * @param idx Index config
   */
  static projectIndex<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item?: Partial<T>, cfg?: ComputeConfig) {
    const res = {} as Record<string, unknown>;
    for (const { path, value } of this.computeIndexParts(cls, idx, item ?? {}, cfg).fields) {
      let sub = res;
      const all = path.slice(0);
      const last = all.pop()!;
      for (const k of all) {
        sub = (sub[k] ??= {}) as typeof res;
      }
      sub[last] = value;
    }
    return res;
  }

  /**
   * Compute index key as a single value
   * @param cls Class to get index for
   * @param idx Index config
   * @param item item to process
   */
  static computeIndexKey<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item: Partial<T> = {}, opts?: ComputeConfig & { sep?: string }) {
    const { fields, sorted } = this.computeIndexParts(cls, idx, item, { ...(opts ?? {}), includeSortInFields: false });
    const key = fields.map(({ value }) => value).map(x => `${x}`).join(opts?.sep ?? 'ᚕ');
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    return !sorted ? { type: cfg.type, key } : { type: cfg.type, key, sort: sorted.value };
  }
}