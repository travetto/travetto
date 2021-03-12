import { Class } from '@travetto/base';

import { ModelType } from '../types/model';
import { ModelBasicSupport } from './basic';

/**
 * Interface for simple CRUD
 *
 * @concrete ../internal/service/common:ModelCrudSupportTarget
 */
export interface ModelCrudSupport extends ModelBasicSupport {

  /**
   * Generate a uuid
   * @param value The optional value to generate a uuid around.  Passing the same value multiple times produces the same output.
   */
  uuid(): string;

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
  upsert<T extends ModelType>(cls: Class<T>, item: T): Promise<T>;

  /**
   * Update Partial
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