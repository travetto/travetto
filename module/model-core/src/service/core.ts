import { Class } from '@travetto/registry';
import { ModelType } from '../types/model';

/**
 * Interface for simple CRUD
 */
export interface ModelCore {
  /**
   * Get by Id
   * @param id The identifier of the document to retrieve
   */
  get<T extends ModelType>(cls: Class<T>, id: string): Promise<T>;

  /**
   * Optionally get an item.  If an item is not found, return undefined.
   *
   * @param id The id of the document to attempt to fetch.
   */
  getOptional<T extends ModelType>(cls: Class<T>, id: string): Promise<T | undefined>;

  /**
   * Create new item
   * @param item The document to create
   */
  create<T extends ModelType>(cls: Class<T>, item: T): Promise<T>;

  /**
   * Update an item
   * @param item The document to update.
   */
  update<T extends ModelType>(cls: Class<T>, item: T): Promise<T>;

  /**
   * Create or update an item
   * @param item The document to upsert
   * @param view The schema view to validate against
   */
  upsert<T extends ModelType>(cls: Class<T>, item: T): Promise<T>;

  /**
   * Partial Update
   * @param id The document identifier to update
   * @param item The document to partially update.
   */
  partialUpdate<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string): Promise<T>;

  /**
   * Delete an item
   * @param id The id of the document to delete
   */
  delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void>;

  /**
   * List all items
   */
  list<T extends ModelType>(cls: Class<T>): AsyncIterator<T>;
}