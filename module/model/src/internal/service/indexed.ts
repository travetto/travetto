import { Class } from '@travetto/base';
import { DeepPartial } from '@travetto/schema';

import { IndexNotSupported } from '../../error/invalid-index';
import { NotFoundError } from '../../error/not-found';
import { ModelRegistry } from '../../registry/model';
import { IndexConfig } from '../../registry/types';
import { ModelCrudSupport } from '../../service/crud';
import { ModelIndexedSupport } from '../../service/indexed';
import { ModelType, OptionalId } from '../../types/model';

type ComputeConfig = {
  includeSortInFields?: boolean;
  emptyValue?: unknown;
  emptySortValue?: unknown;
};

type IndexFieldPart = { path: string[], value: (string | boolean | Date | number) };
type IndexSortPart = { path: string[], dir: number, value: number | Date };

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
  static computeIndexParts<T extends ModelType>(
    cls: Class<T>, idx: IndexConfig<T> | string, item: DeepPartial<T>, opts: ComputeConfig = {}
  ): { fields: IndexFieldPart[], sorted: IndexSortPart | undefined } {
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    const sortField = cfg.type === 'sorted' ? cfg.fields[cfg.fields.length - 1] : undefined;

    const fields: IndexFieldPart[] = [];
    let sortDir: number = 0;
    let sorted: IndexSortPart | undefined;

    for (const field of cfg.fields) {
      let f: Record<string, unknown> = field;
      let o: Record<string, unknown> = item;
      const parts = [];

      while (o !== undefined && o !== null) {
        const k = Object.keys(f)[0];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        o = (o[k] as Record<string, unknown>);
        parts.push(k);
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const fk = k as (keyof typeof f);
        if (typeof f[fk] === 'boolean' || typeof f[fk] === 'number') {
          if (cfg.type === 'sorted') {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            sortDir = f[fk] === true ? 1 : f[fk] as number;
          }
          break; // At the bottom
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          f = f[fk] as Record<string, unknown>;
        }
      }
      if (field === sortField) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        sorted = { path: parts, dir: sortDir, value: o as unknown as number | Date };
      }
      if (o === undefined || o === null) {
        const empty = field === sortField ? opts.emptySortValue : opts.emptyValue;
        if (empty === undefined || empty === Error) {
          throw new IndexNotSupported(cls, cfg, `Missing field value for ${parts.join('.')}`);
        }
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        o = empty as Record<string, unknown>;
      } else {
        if (field !== sortField || (opts.includeSortInFields ?? true)) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
  static projectIndex<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item?: DeepPartial<T>, cfg?: ComputeConfig): Record<string, unknown> {
    const res: Record<string, unknown> = {};
    for (const { path, value } of this.computeIndexParts(cls, idx, item ?? {}, cfg).fields) {
      let sub = res;
      const all = path.slice(0);
      const last = all.pop()!;
      for (const k of all) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
  static computeIndexKey<T extends ModelType>(
    cls: Class<T>,
    idx: IndexConfig<T> | string,
    item: DeepPartial<T> = {},
    opts?: ComputeConfig & { sep?: string }
  ): { type: string, key: string, sort?: number | Date } {
    const { fields, sorted } = this.computeIndexParts(cls, idx, item, { ...(opts ?? {}), includeSortInFields: false });
    const key = fields.map(({ value }) => value).map(x => `${x}`).join(opts?.sep ?? 'ᚕ');
    const cfg = typeof idx === 'string' ? ModelRegistry.getIndex(cls, idx) : idx;
    return !sorted ? { type: cfg.type, key } : { type: cfg.type, key, sort: sorted.value };
  }

  /**
   * Naive upsert by index
   * @param service
   * @param cls
   * @param idx
   * @param body
   */
  static async naiveUpsert<T extends ModelType>(
    service: ModelIndexedSupport & ModelCrudSupport,
    cls: Class<T>, idx: string, body: OptionalId<T>
  ): Promise<T> {
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const { id } = await service.getByIndex(cls, idx, body as DeepPartial<T>);
      body.id = id;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return await service.update(cls, body as T);
    } catch (err) {
      if (err instanceof NotFoundError) {
        return await service.create(cls, body);
      } else {
        throw err;
      }
    }
  }
}