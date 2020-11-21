import { Class } from '@travetto/registry';
import { IndexConfig } from '../registry/types';
import { ModelType } from '../types/model';
import { ModelCrudSupport } from './crud';
import { ModelStorageSupport } from './storage';

/**
 * Support for simple indexed activity
 *
 * @concrete ../internal/service/common:ModelIndexedSupportTarget
 */
export interface ModelIndexedSupport extends ModelCrudSupport, ModelStorageSupport {

  /**
   * Create index at runtime, used for devevlopment
   */
  createIndex(idx: IndexConfig<any>): Promise<void>;

  /**
   * Delete index at runtime, used for devevlopment
   */
  deleteIndex(idx: IndexConfig<any>): Promise<void>;

  /**
   * Get entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param body The payload of fields needed to search
   */
  getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>): Promise<T>;
}