import type { Class, DeepPartial } from '@travetto/runtime';

import type { ModelType, OptionalId } from '../types/model.ts';
import type { ModelBasicSupport } from './basic.ts';

export type ModelIndexedListPageOptions<T extends ModelType, O = string> = {
  body?: DeepPartial<T>;
  limit: number;
  offset?: O;
};

export type ModelIndexListPageResult<T extends ModelType> = {
  items: T[];
  nextOffset?: string;
};

/**
 * Support for simple indexed activity
 *
 * @concrete
 */
export interface ModelIndexedSupport extends ModelBasicSupport {
  /**
   * Get entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param body The payload of fields needed to search
   */
  getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T>;

  /**
   * Delete entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param body The payload of fields needed to search
   */
  deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void>;

  /**
   * List entity by ranged index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param body The configuration for listing
   */
  listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T>;

  /**
   * Upsert by index, allowing the index to act as a primary key
   * @param cls The type to create for
   * @param idx The index name to use
   * @param body The document to potentially store
   */
  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T>;

  /**
   * Update by index
   * @param cls The type to update for
   * @param idx The index to update by
   * @param body The document to update
   */
  updateByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: T): Promise<T>;

  /**
   * Update partial by index
   * @param cls The type to update for
   * @param idx The index to update by
   * @param body The partial document to update
   */
  updatePartialByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T>;

  /**
   * List entity by ranged index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param options The configuration for listing
   */
  listPageByIndex<T extends ModelType>(cls: Class<T>, idx: string, options: ModelIndexedListPageOptions<T>): Promise<ModelIndexListPageResult<T>>;
}