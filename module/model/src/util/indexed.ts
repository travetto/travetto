import { castTo, Class, DeepPartial, hasFunction, TypedObject } from '@travetto/runtime';

import { IndexNotSupported } from '../error/invalid-index.ts';
import { NotFoundError } from '../error/not-found.ts';
import type { IndexConfig } from '../registry/types.ts';
import type { ModelCrudSupport } from '../types/crud.ts';
import type { ModelIndexedSupport } from '../types/indexed.ts';
import type { ModelType, OptionalId } from '../types/model.ts';
import { ModelRegistryIndex } from '../registry/registry-index.ts';

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
   * Type guard for determining if service supports indexed operation
   */
  static isSupported = hasFunction<ModelIndexedSupport>('getByIndex');

  /**
   * Compute flattened field to value mappings
   * @param cls Class to get info for
   * @param idx Index config
   * @param item Item to read values from
   */
  static computeIndexParts<T extends ModelType>(
    cls: Class<T>, idx: IndexConfig<T> | string, item: DeepPartial<T>, opts: ComputeConfig = {}
  ): { fields: IndexFieldPart[], sorted: IndexSortPart | undefined } {
    const config = typeof idx === 'string' ? ModelRegistryIndex.getIndex(cls, idx) : idx;
    const sortField = config.type === 'sorted' ? config.fields.at(-1) : undefined;

    const fields: IndexFieldPart[] = [];
    let sortDir: number = 0;
    let sorted: IndexSortPart | undefined;

    for (const field of config.fields) {
      let f: Record<string, unknown> = field;
      let o: Record<string, unknown> = item;
      const parts = [];

      while (o !== undefined && o !== null) {
        const k = TypedObject.keys(f)[0];
        o = castTo(o[k]);
        parts.push(k);
        if (typeof f[k] === 'boolean' || typeof f[k] === 'number') {
          if (config.type === 'sorted') {
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
          throw new IndexNotSupported(cls, config, `Missing field value for ${parts.join('.')}`);
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
  static projectIndex<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, item?: DeepPartial<T>, config?: ComputeConfig): Record<string, unknown> {
    const response: Record<string, unknown> = {};
    for (const { path, value } of this.computeIndexParts(cls, idx, item ?? {}, config).fields) {
      let sub: Record<string, unknown> = response;
      const all = path.slice(0);
      const last = all.pop()!;
      for (const k of all) {
        sub = castTo(sub[k] ??= {});
      }
      sub[last] = value;
    }
    return response;
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
    config?: ComputeConfig & { sep?: string }
  ): { type: string, key: string, sort?: number | Date } {
    const { fields, sorted } = this.computeIndexParts(cls, idx, item, { ...(config ?? {}), includeSortInFields: false });
    const key = fields.map(({ value }) => value).map(x => `${x}`).join(config?.sep ?? DEFAULT_SEP);
    const indexConfig = typeof idx === 'string' ? ModelRegistryIndex.getIndex(cls, idx) : idx;
    return !sorted ? { type: indexConfig.type, key } : { type: indexConfig.type, key, sort: sorted.value };
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
    } catch (error) {
      if (error instanceof NotFoundError) {
        return await service.create(cls, body);
      } else {
        throw error;
      }
    }
  }
}