import { castTo, Class, Util, asConstructable, AppError } from '@travetto/runtime';
import { DataUtil, SchemaRegistry, SchemaValidator, ValidationError, ValidationResultError } from '@travetto/schema';

import { ModelRegistry } from '../../registry/model';
import { ModelIdSource, ModelType, OptionalId } from '../../types/model';
import { NotFoundError } from '../../error/not-found';
import { ExistsError } from '../../error/exists';
import { SubTypeNotSupportedError } from '../../error/invalid-sub-type';
import { DataHandler, PrePersistScope } from '../../registry/types';

export type ModelCrudProvider = {
  idSource: ModelIdSource;
};

/**
 * Crud utilities
 */
export class ModelCrudUtil {

  /**
   * Build a uuid generator
   */
  static uuidSource(len: number = 32): ModelIdSource {
    const create = (): string => Util.uuid(len);
    const valid = (id: string): boolean => id.length === len && /^[0-9a-f]+$/i.test(id);
    return { create, valid };
  }

  /**
   * Load model
   * @param cls Class to load model for
   * @param input Input as string or plain object
   */
  static async load<T extends ModelType>(cls: Class<T>, input: Buffer | string | object, onTypeMismatch: 'notfound' | 'exists' = 'notfound'): Promise<T> {
    let resolvedInput: object;
    if (typeof input === 'string') {
      resolvedInput = JSON.parse(input);
    } else if (input instanceof Buffer) {
      resolvedInput = JSON.parse(input.toString('utf8'));
    } else {
      resolvedInput = input;
    }

    const result = ModelRegistry.getBaseModel(cls).from(resolvedInput);

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

    const config = ModelRegistry.get(asConstructable(item).constructor);
    if (config.subType) { // Sub-typing, assign type
      SchemaRegistry.ensureInstanceTypeField(cls, item);
    }

    item = await this.prePersist(cls, item, scope);

    let errors: ValidationError[] = [];
    try {
      await SchemaValidator.validate(cls, item);
    } catch (err) {
      if (err instanceof ValidationResultError) {
        errors = err.details.errors;
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
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
  }

  /**
   * Pre persist behavior
   */
  static async prePersist<T>(cls: Class<T>, item: T, scope: PrePersistScope): Promise<T> {
    const config = ModelRegistry.get(cls);
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
    const config = ModelRegistry.get(cls);
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
      throw new AppError(`A partial update requires a plain object, not an instance of ${castTo<Function>(item).constructor.name}`, { category: 'data' });
    }
    const keys = Object.keys(item);
    if ((keys.length === 1 && item.id) || keys.length === 0) {
      throw new AppError('No fields to update');
    } else {
      item = { ...item };
      delete item.id;
    }
    const res = await this.prePersist(cls, castTo(item), 'partial');
    await SchemaValidator.validatePartial(cls, item, view);
    return res;
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