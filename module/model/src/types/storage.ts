import { Class } from '@travetto/runtime';

import { ModelType } from '../types/model.ts';

/**
 * This interface defines the behavior for dealing with the
 * underlying storage mechanism for the datastore.  It handles when
 * a model is added/removed/changed.
 *
 * This is intended to be used during development only for rapid prototyping.
 *
 * @concrete
 */
export interface ModelStorageSupport {

  /**
   * Should storage modification be allowed
   */
  readonly config?: {
    modifyStorage?: boolean;
  };

  /**
   * Initialize storage
   */
  createStorage(): Promise<void>;
  /**
   * Delete storage
   */
  deleteStorage(): Promise<void>;
  /**
   * Creates model
   */
  upsertModel?<T extends ModelType>(cls: Class<T>): Promise<void>;
  /**
   * Exports model
   */
  exportModel?<T extends ModelType>(cls: Class<T>): Promise<string>;
  /**
   * Deletes model
   */
  deleteModel?<T extends ModelType>(cls: Class<T>): Promise<void>;
  /**
   * Removes all data from a model, but leaving the structure in place
   */
  truncateModel?<T extends ModelType>(cls: Class<T>): Promise<void>;
  /**
   * Truncate blob storage data
   */
  truncateBlob?(): Promise<void>;
}