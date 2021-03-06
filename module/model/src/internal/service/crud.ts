import * as crypto from 'crypto';

import { Class, Util } from '@travetto/base';
import { SchemaRegistry, SchemaValidator } from '@travetto/schema';

import { ModelRegistry } from '../../registry/model';
import { ModelType, OptionalId } from '../../types/model';
import { NotFoundError } from '../../error/not-found';
import { ExistsError } from '../../error/exists';
import { SubTypeNotSupportedError } from '../../error/invalid-sub-type';

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
  static async load<T extends ModelType>(cls: Class<T>, input: Buffer | string | object, onTypeMismatch: 'notfound' | 'exists' = 'notfound'): Promise<T> {
    if (typeof input === 'string') {
      input = JSON.parse(input);
    } else if (input instanceof Buffer) {
      input = JSON.parse(input.toString('utf8'));
    }

    const result = ModelRegistry.getBaseModel(cls).from(input as object) as T;

    if (!(result instanceof cls || result.constructor.ᚕid === cls.ᚕid)) {
      if (onTypeMismatch === 'notfound') {
        throw new NotFoundError(cls, result.id);
      } else {
        throw new ExistsError(cls, result.id);
      }
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
  static async preStore<T extends ModelType>(cls: Class<T>, item: Partial<OptionalId<T>>, idSource: { uuid(): string }): Promise<T> {
    if (!item.id) {
      item.id = idSource.uuid();
    }

    if (Util.isPlainObject(item)) {
      item = cls.from(item as {});
    }

    const config = ModelRegistry.get(item.constructor as Class<T>);
    if (config.subType) { // Subtyping, assign type
      SchemaRegistry.ensureInstanceTypeField(cls, item);
    }

    await SchemaValidator.validate(cls, item);

    if (item.prePersist) {
      await item.prePersist();
    }

    return item as T;
  }

  /**
   * Performs a naive partial update by fetching, patching, and then storing
   * @param cls Type to store for
   * @param item The object to use for a partial update
   * @param view The schema view to validate against
   * @param getExisting How to fetch an existing item
   */
  static async naivePartialUpdate<T extends ModelType>(cls: Class<T>, item: Partial<T>, view: undefined | string, getExisting: () => Promise<T>): Promise<T> {
    if (Util.isPlainObject(item)) {
      item = cls.from(item as {});
    }

    const config = ModelRegistry.get(item.constructor as Class<T>);
    if (config.subType) { // Subtyping, assign type
      SchemaRegistry.ensureInstanceTypeField(cls, item);
    }

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

  /**
   * Ensure subtype is not supported
   */
  static ensureNotSubType(cls: Class) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
  }
}