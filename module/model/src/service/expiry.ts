import { Class } from '@travetto/base';
import { ModelType } from '../types/model';
import { ModelCrudSupport } from './crud';

/**
 * Expiry state
 */
export interface ExpiryState {
  /**
   * Expire timestamp in ms
   */
  expiresAt: Date;
  /**
   * Issue timestamp in ms
   */
  issuedAt?: Date;
  /**
   * Max age in ms
   */
  maxAge?: number;
  /**
   * Expired?
   */
  expired: boolean;
}

/**
 * Support for managing expiration of data
 *
 * @concrete ../internal/service/common:ModelExpirySupportTarget
 */
export interface ModelExpirySupport extends ModelCrudSupport {
  /**
   * Determines if the associated document is expired
   *
   * @param id The identifier of the document
   */
  getExpiry<T extends ModelType>(cls: Class<T>, id: string): Promise<ExpiryState>;

  /**
   * Delete all expired by class
   *
   * @returns Returns the number of documents expired
   */
  deleteExpired?<T extends ModelType>(cls: Class<T>): Promise<number>;
}