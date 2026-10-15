import { type BinaryArray, BinaryUtil, type Class, castKey, castTo, hasFunction, JSONUtil, RuntimeError, Util } from '@travetto/runtime';
import { DataUtil, SchemaRegistryIndex, SchemaValidator, type ValidationError, ValidationResultError } from '@travetto/schema';

import { ExistsError } from '../error/exists.ts';
import { SubTypeNotSupportedError } from '../error/invalid-sub-type.ts';
import { NotFoundError } from '../error/not-found.ts';
import { ModelRegistryIndex } from '../registry/registry-index.ts';
import type { DataHandler, PrePersistScope } from '../registry/types.ts';
import type { ModelCrudSupport } from '../types/crud.ts';
import type { ModelType } from '../types/model.ts';

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
      const id = ModelRegistryIndex.getIdSource(cls).getOptionalValue(result);
      if (onTypeMismatch === 'notfound') {
        throw new NotFoundError(cls, id ?? 'unknown');
      } else {
        throw new ExistsError(cls, id ?? 'unknown');
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
  static async preStore<T extends ModelType>(
    cls: Class<T>,
    item: Partial<T>,
    scope: PrePersistScope = 'all'
  ): Promise<[id: string, item: T]> {
    const idSource = ModelRegistryIndex.getIdSource(cls);

    let currentId = idSource.getOptionalValue(item);
    if (!currentId && idSource.generator) {
      currentId = idSource.generator();
      idSource.setValue(item, currentId);
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

    if (!currentId && !idSource.generator) {
      errors.push({ kind: 'required', path: castTo(idSource.field), type: 'string', message: `${String(idSource.field)} is required` });
    }

    if (errors.length) {
      throw new ValidationResultError(errors);
    }
    return [currentId!, castTo(item)];
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
   * Ensure everything is correct for a partial update
   */
  static async prePartialUpdate<T extends ModelType>(cls: Class<T>, item: Partial<T>): Promise<Partial<T>> {
    if (!DataUtil.isPlainObject(item)) {
      throw new RuntimeError(`A partial update requires a plain object, not an instance of ${castTo<Function>(item).constructor.name}`, {
        category: 'data'
      });
    }
    const idSource = ModelRegistryIndex.getIdSource(cls);
    const id = idSource.getOptionalValue(item);
    const keys = Object.keys(item);
    if ((keys.length === 1 && id) || keys.length === 0) {
      throw new RuntimeError('No fields to update');
    } else {
      item = { ...item };
      idSource.deleteValue(item);
    }

    const result = await this.prePersist(cls, castTo(item), 'partial');
    await SchemaValidator.validatePartial(cls, item);
    return result;
  }

  /**
   * Ensure everything is correct for a partial update
   */
  static async naivePartialUpdate<T extends ModelType>(cls: Class<T>, get: () => Promise<T>, item: Partial<T>): Promise<T> {
    const prepared = await this.prePartialUpdate(cls, item);
    const full = await get();
    return cls.from(castTo({ ...full, ...prepared }));
  }
}
