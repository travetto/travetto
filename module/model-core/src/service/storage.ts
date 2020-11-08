import { ChangeEvent, Class } from '@travetto/registry';
import { SchemaChangeEvent } from '@travetto/schema';
import { ModelCrudSupport } from './crud';
import { ModelType } from '../types/model';

/**
 * This interface defines the behavior for dealing with the
 * underlying storage mechanism for the datastore.  It handles when
 * a model is added/removed/changed.
 *
 * This is intended to be used during development only for rapid prototyping.
 *
 * @concrete ./internal:ModelStorageSupportTarget
 */
export interface ModelStorageSupport extends ModelCrudSupport {
  /**
   * Initialize storage
   */
  createStorage(): Promise<void>;
  /**
   * Delete storage
   */
  deleteStorage(): Promise<void>;
  /**
   * An event listener for whenever a model is added, changed or removed
   */
  onModelVisiblityChange?<T extends ModelType>(e: ChangeEvent<Class<T>>): void;
  /**
   * An event listener for whenever a model schema is changed
   */
  onModelSchemaChange?(e: SchemaChangeEvent): void;
}