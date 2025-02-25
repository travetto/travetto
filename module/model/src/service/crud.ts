import { Class } from '@travetto/runtime';

import { ModelType, OptionalId, ModelIdSource } from '../types/model.ts';

import { ModelBasicSupport } from './basic.ts';

/**
 * Interface for simple CRUD
 * @concrete ../internal/service/common.ts#ModelCrudSupportTarget
 */
export interface ModelCrudSupport extends ModelBasicSupport {

  /**
   * Id Source
   */
  idSource: ModelIdSource;

  /**
   * Update an item
   * @param item The document to update.
   * @throws {NotFoundError} When an item is not found
   */
  update<T extends ModelType>(cls: Class<T>, item: T): Promise<T>;

  /**
   * Create or update an item
   * @param item The document to upsert
   * @param view The schema view to validate against
   */
  upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T>;

  /**
   * Update partial, respecting only top level keys.
   *
   * When invoking this method, any top level keys that are null/undefined are treated as removals/deletes.  Any properties
   * that point to sub objects/arrays are treated as wholesale replacements.
   *
   * @param id The document identifier to update
   * @param item The document to partially update.
   * @param view The schema view to validate against
   * @throws {NotFoundError} When an item is not found
   */
  updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T>;

  /**
   * List all items
   */
  list<T extends ModelType>(cls: Class<T>): AsyncIterable<T>;
}