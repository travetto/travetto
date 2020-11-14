import { AppError } from '@travetto/base';
import { Class } from '@travetto/registry';
import { SchemaValidator } from '@travetto/schema';
import { ModelRegistry } from '../../registry/registry';
import { ModelType } from '../../types/model';

/**
 * Crud utilities
 */
export class ModelCrudUtil {
  /**
   * Load model
   * @param cls Class to load model for
   * @param input Input as string or plain object
   */
  static async load<T extends ModelType>(cls: Class<T>, input: Buffer | string | object | null | undefined): Promise<T | undefined> {
    if (!input) {
      return;
    }
    try {
      if (typeof input === 'string') {
        input = JSON.parse(input);
      } else if (input instanceof Buffer) {
        input = JSON.parse(input.toString('utf8'));
      }

      const result = ModelRegistry.getBaseModel(cls).from(input as object);
      if (!(result instanceof cls)) {
        return;
      }
      if (result.postLoad) {
        await result.postLoad();
      }
      return result;
    } catch (e) {
      if (!(e instanceof AppError && /match expected class/.test(e.message))) {
        throw e;
      }
    }
  }

  /**
   * Prepares item for storge
   *
   * @param cls Type to store for
   * @param item Item to store
   */
  static async preStore<T extends ModelType>(cls: Class<T>, item: T, idSource: { uuid(): string }) {
    if (!item.id) {
      item.id = idSource.uuid();
    }

    await SchemaValidator.validate(cls, item);

    if (item.prePersist) {
      await item.prePersist();
    }

    return item;
  }

  static async naivePartialUpdate<T extends ModelType>(cls: Class<T>, item: Partial<T>, view: undefined | string, getExisting: () => Promise<T>): Promise<T> {
    if (view) {
      await SchemaValidator.validate(cls, item, view);
    }

    const existing = await getExisting();

    item = Object.assign(existing, item);

    if (item.prePersist) {
      await item.prePersist();
    }

    return item as T;
  }

  static notFoundError(cls: Class | string, id: string) {
    return new AppError(`${typeof cls === 'string' ? cls : cls.name} with id ${id} not found`, 'notfound');
  }

  static existsError(cls: Class | string, id: string) {
    return new AppError(`${typeof cls === 'string' ? cls : cls.name} with id ${id} already exists`, 'data');
  }
}