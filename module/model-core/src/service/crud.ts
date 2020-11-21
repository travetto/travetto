import { Class } from '@travetto/registry';
import { ModelType } from '../types/model';

/**
 * Interface for simple CRUD
 *
 * @concrete ../internal/service/common:ModelCrudSupportTarget
 */
export interface ModelCrudSupport {

  /**
   * Generate a uuid
   * @param value The optional value to generate a uuid around.  Passing the same value multiple times produces the same output.
   */
  uuid(): string;

  /**
   * Get by Id
   * @param id The identifier of the document to retrieve
   * @throws {NotFoundError} When an item is not found
   */
  get<T extends ModelType>(cls: Class<T>, id: string): Promise<T>;

  /**
   * Create new item
   * @param item The document to create
   * @throws {ExistsError} When an item with the provdided id already exists
   */
  create<T extends ModelType>(cls: Class<T>, item: T): Promise<T>;

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
  updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string): Promise<T>;

  /**
   * Delete an item
   * @param id The id of the document to delete
   * @throws {NotFoundError} When an item is not found
   */
  delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void>;

  /**
   * List all items
   */
  list<T extends ModelType>(cls: Class<T>): AsyncIterable<T>;
}