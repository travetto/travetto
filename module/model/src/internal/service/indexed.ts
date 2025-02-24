import { castTo, Class, DeepPartial, TypedObject } from '@travetto/runtime';

import { IndexNotSupported } from '../../error/invalid-index.ts';
import { NotFoundError } from '../../error/not-found.ts';
import { ModelRegistry } from '../../registry/model.ts';
import { IndexConfig } from '../../registry/types.ts';
import { ModelCrudSupport } from '../../service/crud.ts';
import { ModelIndexedSupport } from '../../service/indexed.ts';
import { ModelType, OptionalId } from '../../types/model.ts';

type ComputeConfig = {
  includeSortInFields?: boolean;
  emptyValue?: unknown;
  emptySortValue?: unknown;
};

type IndexFieldPart = { path: string[], value: (string | boolean | Date | number) };
type IndexSortPart = { path: string[], dir: number, value: number | Date };

const DEFAULT_SEP = '\u8203';

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
        const k = TypedObject.keys(f)[0];
        o = castTo(o[k]);
        parts.push(k);
        if (typeof f[k] === 'boolean' || typeof f[k] === 'number') {
          if (cfg.type === 'sorted') {
            sortDir = f[k] === true ? 1 : f[k] === false ? 0 : f[k];
          }
          break; // At the bottom
        } else {
          f = castTo(f[k]);
        }
      }
      if (field === sortField) {
        sorted = { path: parts, dir: sortDir, value: castTo(o) };
      }
      if (o === undefined || o === null) {
        const empty = field === sortField ? opts.emptySortValue : opts.emptyValue;
        if (empty === undefined || empty === Error) {
          throw new IndexNotSupported(cls, cfg, `Missing field value for ${parts.join('.')}`);
        }
        o = castTo(empty!);
      } else {
        if (field !== sortField || (opts.includeSortInFields ?? true)) {
          fields.push({ path: parts, value: castTo(o) });
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
      let sub: Record<string, unknown> = res;
      const all = path.slice(0);
      const last = all.pop()!;
      for (const k of all) {
        sub = castTo(sub[k] ??= {});
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
    const key = fields.map(({ value }) => value).map(x => `${x}`).join(opts?.sep ?? DEFAULT_SEP);
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
      const { id } = await service.getByIndex(cls, idx, castTo(body));
      body.id = id;
      return await service.update(cls, castTo(body));
    } catch (err) {
      if (err instanceof NotFoundError) {
        return await service.create(cls, body);
      } else {
        throw err;
      }
    }
  }
}