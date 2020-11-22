import { Class } from '@travetto/registry';
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
   * Get entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param body The payload of fields needed to search
   */
  getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>): Promise<T>;
}