import { Class } from '@travetto/registry';
import { ModelType } from '../types/model';

/**
 * Interface for basic data interface
 *
 * @concrete ../internal/service/common:ModelBasicSupportTarget
 */
export interface ModelBasicSupport {
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
   * Delete an item
   * @param id The id of the document to delete
   * @throws {NotFoundError} When an item is not found
   */
  delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void>;
}