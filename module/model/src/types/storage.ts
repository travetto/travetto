import { Class } from '@travetto/runtime';
import { SchemaChange } from '@travetto/schema';

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
   * Should auto-creation be allowed
   */
  readonly config?: {
    autoCreate?: boolean;
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
   * Installs model
   */
  createModel?<T extends ModelType>(e: Class<T>): Promise<void>;
  /**
   * Installs model
   */
  exportModel?<T extends ModelType>(e: Class<T>): Promise<string>;
  /**
   * Installs model
   */
  deleteModel?<T extends ModelType>(e: Class<T>): Promise<void>;
  /**
   * Removes all data from a model, but leaving the structure in place
   */
  truncateModel?<T extends ModelType>(e: Class<T>): Promise<void>;
  /**
   * Deals with model internals changing
   */
  changeModel?<T extends ModelType>(e: Class<T>): Promise<void>;
  /**
   * An event listener for whenever a model schema is changed
   */
  changeSchema?(cls: Class, changes: SchemaChange): Promise<void>;
  /**
   * Truncate blob storage data
   */
  truncateBlob?(): Promise<void>;
}