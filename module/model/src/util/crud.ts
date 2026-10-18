import { type BinaryArray, BinaryUtil, type Class, castKey, castTo, hasFunction, JSONUtil, RuntimeError } from '@travetto/runtime';
import { DataUtil, SchemaRegistryIndex, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { ExistsError } from '../error/exists.ts';
import { SubTypeNotSupportedError } from '../error/invalid-sub-type.ts';
import { NotFoundError } from '../error/not-found.ts';
import { ModelRegistryIndex } from '../registry/registry-index.ts';
import type { DataHandler, PrePersistScope } from '../registry/types.ts';
import type { ModelCrudSupport } from '../types/crud.ts';
import type { ModelType, OptionalId, PartialWithId } from '../types/model.ts';

type ModelLoadInput = string | BinaryArray | object;

/**
 * Crud utilities
 */
export class ModelCrudUtil {
  /**
   * Type guard for determining if service supports crud operations
   */
  static isSupported = hasFunction<ModelCrudSupport>('upsert');

  static async filterOutNotFound<T extends ModelType>(actions: Promise<T>[] | undefined): Promise<T[]> {
    if (!actions) {
      return [];
    }
    return (await Promise.allSettled(actions))
      .map(p => {
        if (p.status === 'fulfilled') {
          return p.value;
        } else if (p.reason instanceof NotFoundError) {
          return undefined!;
        } else {
          throw p.reason;
        }
      })
      .filter(item => !!item);
  }

  /**
   * Load model
   * @param cls Class to load model for
   * @param input Input as string or plain object
   */
  static async load<T extends ModelType>(
    cls: Class<T>,
    input: ModelLoadInput,
    onTypeMismatch: 'notfound' | 'exists' = 'notfound'
  ): Promise<T> {
    const resolvedInput: object =
      typeof input === 'string' ? JSONUtil.fromUTF8(input) : BinaryUtil.isBinaryArray(input) ? JSONUtil.fromBinaryArray(input) : input;

    const result = SchemaRegistryIndex.getBaseClass(cls).from(resolvedInput);

    if (!(result instanceof cls || result.constructor.Ⲑid === cls.Ⲑid)) {
      if (onTypeMismatch === 'notfound') {
        throw NotFoundError.for(cls, result);
      } else {
        throw ExistsError.for(cls, result);
      }
    }

    return this.postLoad(cls, result);
  }

  /**
   * Prepares item for storage
   *
   * @param cls Type to store for
   * @param item Item to store
   * @param config Configuration options or prePersist scope
   */
  static async preStore<T extends ModelType>(
    cls: Class<T>,
    item: Partial<OptionalId<T>>,
    config?:
      | {
          scope?: PrePersistScope;
          validate?: boolean;
          ensureId?: boolean;
        }
      | PrePersistScope
  ): Promise<T> {
    const resolvedConfig = typeof config === 'string' ? { scope: config } : config;
    const scope = resolvedConfig?.scope ?? 'all';
    const ensureId = resolvedConfig?.ensureId ?? true;

    const idSource = ModelRegistryIndex.get(cls).idSource;
    if (ensureId) {
      idSource.getOrSet(item, ModelRegistryIndex.getConfig(cls).idGenerator);
    }

    if (DataUtil.isPlainObject(item)) {
      item = cls.from(castTo(item));
    }

    SchemaRegistryIndex.get(cls).ensureInstanceTypeField(item);

    item = await this.prePersist(cls, item, scope);

    if (resolvedConfig?.validate ?? true) {
      await SchemaValidator.validate(cls, item);
    }
    return castTo(item);
  }

  /**
   * Pre-create hook: ensures ID is generated if omitted, runs prePersist, and validates schema
   */
  static async preCreate<T extends ModelType>(
    cls: Class<T>,
    item: Partial<OptionalId<T>>,
    options?: { ensureNotSubType?: boolean }
  ): Promise<T> {
    if (options?.ensureNotSubType) {
      this.ensureNotSubType(cls);
    }
    return this.preStore(cls, item, { ensureId: true, scope: 'all' });
  }

  /**
   * Pre-update hook: checks subtype if requested, requires ID (throwing ValidationResultError if missing),
   * runs prePersist, and validates schema
   */
  static async preUpdate<T extends ModelType>(cls: Class<T>, item: T, options?: { ensureNotSubType?: boolean }): Promise<T> {
    if (options?.ensureNotSubType) {
      this.ensureNotSubType(cls);
    }
    return this.preStore(cls, item, { ensureId: false, scope: 'all' });
  }

  /**
   * Pre-upsert hook: checks subtype if requested, ensures ID is generated if omitted,
   * runs prePersist, and validates schema
   */
  static async preUpsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>, options?: { ensureNotSubType?: boolean }): Promise<T> {
    if (options?.ensureNotSubType) {
      this.ensureNotSubType(cls);
    }
    return this.preStore(cls, item, { ensureId: true, scope: 'all' });
  }

  /**
   * Pre-delete hook: checks subtype if requested, and validates ID presence
   */
  static async preDelete<T extends ModelType>(cls: Class<T>, id: string, options?: { ensureNotSubType?: boolean }): Promise<string> {
    if (options?.ensureNotSubType) {
      this.ensureNotSubType(cls);
    }
    if (!id) {
      const field = ModelRegistryIndex.get(cls).idSource.field;
      throw new ValidationResultError([{ kind: 'required', path: castTo(field), type: 'string', message: `${field} is required` }]);
    }
    return id;
  }

  /**
   * Recursively deletes or masks transient fields from an object based on its Model config.
   * If transient fields are present, returns a copy with those fields set to undefined.
   */
  static cleanTransientFields<T>(cls: Class<T>, item: T): T {
    if (!item || typeof item !== 'object') {
      return item;
    }
    if (SchemaRegistryIndex.has(cls)) {
      const schema = SchemaRegistryIndex.get(cls).get();
      const transientFields = ModelRegistryIndex.has(cls) ? ModelRegistryIndex.getConfig(cls).transientFields : undefined;

      const isCleanTarget = (key: string): boolean => {
        return transientFields?.includes(key) ?? false;
      };

      const hasTargets = Object.keys(schema.fields).some(key => isCleanTarget(key));

      let res = item;
      if (hasTargets) {
        res = { ...item };
        for (const key of Object.keys(schema.fields)) {
          if (isCleanTarget(key)) {
            res[castKey<T>(key)] = undefined!;
          }
        }
      }

      for (const [key, field] of Object.entries(schema.fields)) {
        const fieldKey = castKey<typeof res>(key);
        if (!isCleanTarget(key) && res[fieldKey] !== undefined && res[fieldKey] !== null) {
          if (field.array && Array.isArray(res[fieldKey])) {
            const arr = res[fieldKey];
            let changed = false;
            const newArray = arr.map(subItem => {
              const cleaned = this.cleanTransientFields(field.type, subItem);
              if (cleaned !== subItem) {
                changed = true;
              }
              return cleaned;
            });
            if (changed) {
              if (res === item) {
                res = { ...item };
              }
              res[fieldKey] = castTo(newArray);
            }
          } else {
            const val = res[fieldKey];
            const cleaned = this.cleanTransientFields(field.type, val);
            if (cleaned !== val) {
              if (res === item) {
                res = { ...item };
              }
              res[fieldKey] = cleaned;
            }
          }
        }
      }
      return res;
    }
    return item;
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
    for (const state of config.prePersist ?? []) {
      if (state.scope === scope || scope === 'all' || state.scope === 'all') {
        const handler: DataHandler<T> = castTo(state.handler);
        item = (await handler(item)) ?? item;
      }
    }
    return this.cleanTransientFields(cls, item);
  }

  /**
   * Post load behavior
   */
  static async postLoad<T>(cls: Class<T>, item: T): Promise<T> {
    const config = ModelRegistryIndex.getConfig(cls);
    for (const handler of castTo<DataHandler<T>[]>(config.postLoad ?? [])) {
      item = (await handler(item)) ?? item;
    }
    return item;
  }

  /**
   * Ensure everything is correct for a partial update. Validates that `id` is present by default.
   */
  static async prePartialUpdate<T extends ModelType>(
    cls: Class<T>,
    item: Partial<T> | PartialWithId<T>,
    options?: { validateId?: boolean; ensureNotSubType?: boolean }
  ): Promise<Partial<T>> {
    if (options?.ensureNotSubType) {
      this.ensureNotSubType(cls);
    }
    if (!DataUtil.isPlainObject(item)) {
      throw new RuntimeError(`A partial update requires a plain object, not an instance of ${castTo<Function>(item).constructor.name}`, {
        category: 'data'
      });
    }
    const idSource = ModelRegistryIndex.get(cls).idSource;
    const id = idSource.get(item, { optional: true });
    const keys = Object.keys(item);
    if ((keys.length === 1 && id) || keys.length === 0) {
      throw new RuntimeError('No fields to update');
    } else {
      item = { ...item };
      idSource.clear(item);
    }

    const result = await this.prePersist(cls, castTo(item), 'partial');
    if (options?.validateId ?? false) {
      idSource.get(item); // Throws ValidationResultError if id is missing
    }
    await SchemaValidator.validatePartial(cls, item);

    return castTo(result);
  }

  /**
   * Apply a prepared partial update to an existing entity retrieved via `get`
   */
  static async naivePartialUpdate<T extends ModelType>(
    cls: Class<T>,
    get: (id?: string) => Promise<T>,
    prepared: Partial<T>,
    id?: string
  ): Promise<T> {
    const full = await get(id);
    return cls.from(castTo({ ...full, ...prepared }));
  }
}
