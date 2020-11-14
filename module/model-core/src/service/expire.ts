import { Class } from '@travetto/registry';
import { ModelCrudSupport } from './crud';
import { ModelType } from '../types/model';

/**
 * Basic state for expiry requests
 */
export interface ExpiryState {
  /**
   * Expire timestamp in ms
   */
  expiresAt: number;
  /**
   * Issue timestamp in ms
   */
  issuedAt: number;
  /**
   * Is this expired
   */
  expired: boolean;
  /**
   * The specified max age
   */
  maxAge: number;
}

/**
 * Support for managing expiration of data
 *
 * @concrete ./internal:ModelExpirySupportTarget
 */
export interface ModelExpirySupport extends ModelCrudSupport {
  /**
   * Set expiry time for a record of a given id
   *
   * @param id The identifier of the document
   * @param ttl Time to live in seconds
   */
  updateExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number): Promise<void>;

  /**
   * Upsert a document with expiry
   *
   * @param item The item to upsert
   * @param ttl The ttl for expiry
   */
  upsertWithExpiry<T extends ModelType>(cls: Class<T>, item: T, ttl: number): Promise<T>;

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