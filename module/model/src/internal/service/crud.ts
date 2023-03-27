import crypto from 'crypto';

import { Class, ObjectUtil, Util } from '@travetto/base';
import { SchemaRegistry, SchemaValidator, ValidationError, ValidationResultError } from '@travetto/schema';

import { ModelRegistry } from '../../registry/model';
import { ModelType, OptionalId } from '../../types/model';
import { NotFoundError } from '../../error/not-found';
import { ExistsError } from '../../error/exists';
import { SubTypeNotSupportedError } from '../../error/invalid-sub-type';
import { ModelUuidGenerator } from '../../service/types';

/**
 * Crud utilities
 */
export class ModelCrudUtil {

  /**
   * Build a uuid generator
   */
  static uuidGenerator(create: () => string, valid: (id: string) => boolean): ModelUuidGenerator;
  static uuidGenerator(len?: number): ModelUuidGenerator;
  static uuidGenerator(lenOrCreate: (() => string) | number = 32, valid?: (id: string) => boolean): ModelUuidGenerator {
    if (typeof lenOrCreate === 'number') {
      const len = lenOrCreate;
      const create = (): string => Util.uuid(len);
      create.valid = (id: string): boolean => id.length === len && /^[0-9a-f]+$/i.test(id);
      return create;
    } else {
      const create = (): string => lenOrCreate();
      create.valid = valid!;
      return create;
    }
  }

  /**
   * Provide hash value
   * @param value Input value
   * @param length Number of characters to produce
   */
  static hashValue(value: string, length = 32): string {
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

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = ModelRegistry.getBaseModel(cls).from(input as object) as T;

    if (!(result instanceof cls || result.constructor.Ⲑid === cls.Ⲑid)) {
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
   * Prepares item for storage
   *
   * @param cls Type to store for
   * @param item Item to store
   */
  static async preStore<T extends ModelType>(cls: Class<T>, item: Partial<OptionalId<T>>, idSource: { uuid: ModelUuidGenerator }): Promise<T> {
    if (!item.id) {
      item.id = idSource.uuid();
    }

    if (ObjectUtil.isPlainObject(item)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      item = cls.from(item as object);
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const config = ModelRegistry.get(item.constructor as Class<T>);
    if (config.subType) { // Sub-typing, assign type
      SchemaRegistry.ensureInstanceTypeField(cls, item);
    }

    let errors: ValidationError[] = [];
    try {
      await SchemaValidator.validate(cls, item);
    } catch (err) {
      if (err instanceof ValidationResultError) {
        errors = err.errors;
      }
    }

    if (!idSource.uuid.valid(item.id!)) {
      errors.push({ kind: 'invalid', path: 'id', value: item.id!, type: 'string', message: `${item.id!} is an invalid value for \`id\`` });
    }

    if (errors.length) {
      throw new ValidationResultError(errors);
    }

    if (item.prePersist) {
      await item.prePersist();
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
    if (ObjectUtil.isPlainObject(item)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      item = cls.from(item as object);
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const config = ModelRegistry.get(item.constructor as Class<T>);
    if (config.subType) { // Sub-typing, assign type
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

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return item as T;
  }

  /**
   * Ensure subtype is not supported
   */
  static ensureNotSubType(cls: Class): void {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
  }
}