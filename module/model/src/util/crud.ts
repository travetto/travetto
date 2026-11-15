import {
  asConstructable,
  type BinaryArray,
  BinaryUtil,
  type Class,
  castTo,
  hasFunction,
  isPlainRecord,
  JSONUtil,
  RuntimeError,
  type UnknownRecord,
  isRecord
} from '@travetto/runtime';
import { SchemaRegistryIndex, SchemaValidator, ValidationResultError } from '@travetto/schema';

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
      idSource.getOrSet(item);
    }

    if (isPlainRecord(item)) {
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
   * runs prePersist, validates schema, and optionally invokes `getOperation` to verify existing record
   */
  static async preUpdate<T extends ModelType>(
    cls: Class<T>,
    item: T,
    options?: {
      ensureNotSubType?: boolean;
      getOperation?: (id: string) => Promise<unknown>;
      readBeforeUpdate?: boolean;
      getBeforeRead?: boolean;
    }
  ): Promise<T> {
    if (options?.ensureNotSubType) {
      this.ensureNotSubType(cls);
    }
    const prepped = await this.preStore(cls, item, { ensureId: false, scope: 'all' });
    const shouldRead = options?.readBeforeUpdate ?? options?.getBeforeRead ?? true;
    if (shouldRead && options?.getOperation) {
      const id = ModelRegistryIndex.get(cls).idSource.get(prepped);
      await options.getOperation(id);
    }
    return prepped;
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
  static cleanTransientFields<T extends ModelType, U extends ModelType = T>(cls: Class<T>, item: U): U {
    if (!isRecord(item) || !SchemaRegistryIndex.has(cls)) {
      return item;
    }

    const schema = SchemaRegistryIndex.get(cls).get();
    const transientFields = ModelRegistryIndex.has(cls) ? ModelRegistryIndex.getConfig(cls).transientFields : undefined;

    const isCleanTarget = (key: string): boolean => {
      return transientFields?.includes(key) ?? false;
    };

    const hasTargets = Object.keys(schema.fields).some(key => isCleanTarget(key));

    let result: U = item;
    let modified = false;

    const setField = (key: string, value?: unknown) => {
      if (!modified) {
        modified = true;
        result = { ...result }; // Copy on first write
      }
      castTo<UnknownRecord>(result)[key] = value;
    };

    if (hasTargets) {
      for (const key of Object.keys(schema.fields)) {
        if (isCleanTarget(key)) {
          setField(key, undefined);
        }
      }
    }

    for (const [key, field] of Object.entries(schema.fields)) {
      const currentField = castTo<UnknownRecord>(result)[key];
      if (field.type.kind === 'complex' && !isCleanTarget(key) && currentField !== undefined && currentField !== null) {
        const fieldType = field.type.value;
        if (field.array && Array.isArray(currentField)) {
          let changed = false;
          const newArray = currentField.map(subItem => {
            const cleaned = this.cleanTransientFields(fieldType, subItem);
            if (cleaned !== subItem) {
              changed = true;
            }
            return cleaned;
          });
          if (changed) {
            setField(key, newArray);
          }
        } else {
          const cleaned = this.cleanTransientFields(fieldType, currentField);
          if (cleaned !== currentField) {
            setField(key, cleaned);
          }
        }
      }
    }
    return result;
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
  static async prePersist<T extends ModelType, U extends object = T>(cls: Class<T>, item: U, scope: PrePersistScope): Promise<U> {
    const config = ModelRegistryIndex.getConfig(cls);
    for (const state of config.prePersist ?? []) {
      if (state.scope === scope || scope === 'all' || state.scope === 'all') {
        const handler: DataHandler<U> = castTo(state.handler);
        item = (await handler(item)) ?? item;
      }
    }
    return this.cleanTransientFields(cls, item);
  }

  /**
   * Post load behavior
   */
  static async postLoad<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    const config = ModelRegistryIndex.getConfig<T>(cls);
    for (const handler of config.postLoad ?? []) {
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
    if (!isPlainRecord(item)) {
      throw new RuntimeError(`A partial update requires a plain object, not an instance of ${asConstructable(item).constructor.name}`, {
        category: 'data'
      });
    }
    const idSource = ModelRegistryIndex.get(cls).idSource;
    const id = idSource.get(item, { optional: true });
    const keys = Object.keys(item);
    if ((keys.length === 1 && id) || keys.length === 0) {
      throw new RuntimeError('No fields to update');
    }
    const prepared: Partial<T> = castTo({ ...item });
    idSource.clear(prepared);

    const result = await this.prePersist(cls, prepared, 'partial');
    if (options?.validateId ?? false) {
      idSource.get(prepared); // Throws ValidationResultError if id is missing
    }
    await SchemaValidator.validatePartial(cls, prepared);

    return result;
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
