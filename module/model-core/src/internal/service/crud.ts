import * as crypto from 'crypto';
import { Class } from '@travetto/registry';
import { SchemaValidator } from '@travetto/schema';
import { ModelRegistry } from '../../registry/registry';
import { ModelType } from '../../types/model';
import { TypeMismatchError } from '../../error/type-mismatch';

/**
 * Crud utilities
 */
export class ModelCrudUtil {

  /**
   * Provide hash value
   * @param value Input value
   * @param length Number of characters to produce
   */
  static hashValue(value: string, length = 32) {
    if (value.length < 32) {
      value = value.padEnd(32, ' ');
    }
    return crypto.createHash('sha1').update(value).digest('hex').substring(0, length);
  }

  /**
   * Load model
   * @param cls Class to load model for
   * @param input Input as string or plain object
   */
  static async load<T extends ModelType>(cls: Class<T>, input: Buffer | string | object): Promise<T> {
    if (typeof input === 'string') {
      input = JSON.parse(input);
    } else if (input instanceof Buffer) {
      input = JSON.parse(input.toString('utf8'));
    }

    const result = ModelRegistry.getBaseModel(cls).from(input as object) as T;
    if (!(result instanceof cls)) {
      throw new TypeMismatchError(cls, result.id!, result.type!);
    }
    if (result.postLoad) {
      await result.postLoad();
    }
    return result;
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
}