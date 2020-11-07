import { Class } from '@travetto/registry';
import { ModelCore } from './core';
import { ModelType } from '../types/model';

/**
 * Support for managing expiration of data
 */
export interface ModelExpirable extends ModelCore {
  /**
   * Set expiry time for a record of a given id
   *
   * @param id The identifier of the document
   * @param ttl Time to live in seconds
   */
  expires<T extends ModelType>(cls: Class<T>, id: string, ttl: number): Promise<void>;

  /**
   * Determines if the associated document is expired
   *
   * @param id The identifier of the document
   */
  isExpired<T extends ModelType>(cls: Class<T>, id: string): Promise<boolean>;

  /**
   * Remove all expired by class
   *
   * @returns Returns the number of documents expired
   */
  removeExpired?<T extends ModelType>(cls: Class<T>): Promise<number>;
}