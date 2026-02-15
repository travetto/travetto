import { castTo, type Class, Util, RuntimeError, hasFunction, BinaryUtil, type BinaryArray, JSONUtil } from '@travetto/runtime';
import { DataUtil, SchemaRegistryIndex, SchemaValidator, type ValidationError, ValidationResultError } from '@travetto/schema';

import { ModelRegistryIndex } from '../registry/registry-index.ts';
import type { ModelIdSource, ModelType, OptionalId } from '../types/model.ts';
import { NotFoundError } from '../error/not-found.ts';
import { ExistsError } from '../error/exists.ts';
import { SubTypeNotSupportedError } from '../error/invalid-sub-type.ts';
import type { DataHandler, PrePersistScope } from '../registry/types.ts';
import type { ModelCrudSupport } from '../types/crud.ts';

type ModelLoadInput = string | BinaryArray | object;

export type ModelCrudProvider = {
  idSource: ModelIdSource;
};

/**
 * Crud utilities
 */
export class ModelCrudUtil {

  /**
   * Type guard for determining if service supports crud operations
   */
  static isSupported = hasFunction<ModelCrudSupport>('upsert');

  /**
   * Build a uuid generator
   */
  static uuidSource(length: number = 32): ModelIdSource {
    const create = (): string => Util.uuid(length);
    const valid = (id: string): boolean => id.length === length && /^[0-9a-f]+$/i.test(id);
    return { create, valid };
  }

  /**
   * Load model
   * @param cls Class to load model for
   * @param input Input as string or plain object
   */
  static async load<T extends ModelType>(cls: Class<T>, input: ModelLoadInput, onTypeMismatch: 'notfound' | 'exists' = 'notfound'): Promise<T> {
    const resolvedInput: object =
      typeof input === 'string' ? JSONUtil.fromUTF8(input) :
        BinaryUtil.isBinaryArray(input) ? JSONUtil.fromBinaryArray(input) :
          input;

    const result = SchemaRegistryIndex.getBaseClass(cls).from(resolvedInput);

    if (!(result instanceof cls || result.constructor.Ⲑid === cls.Ⲑid)) {
      if (onTypeMismatch === 'notfound') {
        throw new NotFoundError(cls, result.id);
      } else {
        throw new ExistsError(cls, result.id);
      }
    }

    return this.postLoad(cls, result);
  }

  /**
   * Prepares item for storage
   *
   * @param cls Type to store for
   * @param item Item to store
   */
  static async preStore<T extends ModelType>(cls: Class<T>, item: Partial<OptionalId<T>>, provider: ModelCrudProvider, scope: PrePersistScope = 'all'): Promise<T> {
    if (!item.id) {
      item.id = provider.idSource.create();
    }

    if (DataUtil.isPlainObject(item)) {
      item = cls.from(castTo(item));
    }

    SchemaRegistryIndex.get(cls).ensureInstanceTypeField(item);

    item = await this.prePersist(cls, item, scope);

    let errors: ValidationError[] = [];
    try {
      await SchemaValidator.validate(cls, item);
    } catch (error) {
      if (error instanceof ValidationResultError) {
        errors = error.details.errors;
      }
    }

    if (!provider.idSource.valid(item.id!)) {
      errors.push({ kind: 'invalid', path: 'id', value: item.id!, type: 'string', message: `${item.id!} is an invalid value for \`id\`` });
    }

    if (errors.length) {
      throw new ValidationResultError(errors);
    }
    return castTo(item);
  }

  /**
   * Ensure subtype is not supported
   */
  static ensureNotSubType(cls: Class): void {
    const config = SchemaRegistryIndex.getConfig(cls);
    if (config.discriminatedType && !config.discriminatedBase) {
      throw new SubTypeNotSupportedError(cls);
    }
  }

  /**
   * Pre persist behavior
   */
  static async prePersist<T>(cls: Class<T>, item: T, scope: PrePersistScope): Promise<T> {
    const config = ModelRegistryIndex.getConfig(cls);
    for (const state of (config.prePersist ?? [])) {
      if (state.scope === scope || scope === 'all' || state.scope === 'all') {
        const handler: DataHandler<T> = castTo(state.handler);
        item = await handler(item) ?? item;
      }
    }
    if (typeof item === 'object' && item && 'prePersist' in item && typeof item['prePersist'] === 'function') {
      item = await item.prePersist() ?? item;
    }
    return item;
  }

  /**
   * Post load behavior
   */
  static async postLoad<T>(cls: Class<T>, item: T): Promise<T> {
    const config = ModelRegistryIndex.getConfig(cls);
    for (const handler of castTo<DataHandler<T>[]>(config.postLoad ?? [])) {
      item = await handler(item) ?? item;
    }
    if (typeof item === 'object' && item && 'postLoad' in item && typeof item['postLoad'] === 'function') {
      item = await item.postLoad() ?? item;
    }
    return item;
  }

  /**
   * Ensure everything is correct for a partial update
   */
  static async prePartialUpdate<T extends ModelType>(cls: Class<T>, item: Partial<T>, view?: string): Promise<Partial<T>> {
    if (!DataUtil.isPlainObject(item)) {
      throw new RuntimeError(`A partial update requires a plain object, not an instance of ${castTo<Function>(item).constructor.name}`, { category: 'data' });
    }
    const keys = Object.keys(item);
    if ((keys.length === 1 && item.id) || keys.length === 0) {
      throw new RuntimeError('No fields to update');
    } else {
      item = { ...item };
      delete item.id;
    }
    const result = await this.prePersist(cls, castTo(item), 'partial');
    await SchemaValidator.validatePartial(cls, item, view);
    return result;
  }

  /**
   * Ensure everything is correct for a partial update
   */
  static async naivePartialUpdate<T extends ModelType>(cls: Class<T>, get: () => Promise<T>, item: Partial<T>, view?: string): Promise<T> {
    const prepared = await this.prePartialUpdate(cls, item, view);
    const full = await get();
    return cls.from(castTo({ ...full, ...prepared }));
  }
}