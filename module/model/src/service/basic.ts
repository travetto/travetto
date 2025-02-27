import { Class } from '@travetto/runtime';
import { ModelType, OptionalId } from '../types/model';

/**
 * Interface for basic data interface
 *
 * @concrete .
 */
export interface ModelBasicSupport<C = unknown> {
  /**
   * Get underlying client
   */
  get client(): C;

  /**
   * Get by Id
   * @param id The identifier of the document to retrieve
   * @throws {NotFoundError} When an item is not found
   */
  get<T extends ModelType>(cls: Class<T>, id: string): Promise<T>;

  /**
   * Create new item
   * @param item The document to create
   * @throws {ExistsError} When an item with the provided id already exists
   */
  create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T>;

  /**
   * Delete an item
   * @param id The id of the document to delete
   * @throws {NotFoundError} When an item is not found
   */
  delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void>;
}