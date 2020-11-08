import { Class } from '@travetto/registry';
import { ModelCore } from './core';
import { ModelType } from '../types/model';

interface ExpiryState {
  expiresAt: number;
  issuedAt: number;
  expired: boolean;
  maxAge: number;
}

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
  setExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number): Promise<void>;

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