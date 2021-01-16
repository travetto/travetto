import { Class } from '@travetto/base';
import { ModelType } from '../types/model';
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
  getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>): Promise<T>;

  /**
   * Delete entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param body The payload of fields needed to search
   */
  deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>): Promise<void>;
}