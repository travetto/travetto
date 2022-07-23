import { Class } from '@travetto/base';
import { DeepPartial } from '@travetto/schema';

import { ModelType, OptionalId } from '../types/model';
import { ModelBasicSupport } from './basic';

/**
 * Support for simple indexed activity
 *
 * @concrete ../internal/service/common:ModelIndexedSupportTarget
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
   * @param body The payload of fields needed to search
   */
  listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T>;

  /**
   * Upsert by index, allowing the index to act as a primary key
   * @param cls The type to create for
   * @param idx The index name to use
   * @param body The document to potentially store
   */
  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T>;
}