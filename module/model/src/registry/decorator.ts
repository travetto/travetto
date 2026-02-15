import { RuntimeError, castTo, type Class, getClass } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { ModelType } from '../types/model.ts';
import type { DataHandler, IndexConfig, ModelConfig, PrePersistScope } from './types.ts';
import { ModelRegistryIndex } from './registry-index.ts';

/**
 * Model decorator, extends `@Schema`
 *
 * @augments `@travetto/schema:Schema`
 * @kind decorator
 */
export function Model(config: Partial<ModelConfig<ModelType>> | string = {}) {
  return function <T extends ModelType, U extends Class<T>>(cls: U): U {
    if (typeof config === 'string') {
      config = { store: config };
    }
    ModelRegistryIndex.getForRegister(cls).register(config);
    if (SchemaRegistryIndex.getForRegister(cls).get().fields.id) {
      SchemaRegistryIndex.getForRegister(cls).registerField('id', { required: { active: false } });
    }
    return cls;
  };
}

/**
 * Defines an index on a model
 * @kind decorator
 */
export function Index<T extends ModelType>(...indices: IndexConfig<T>[]) {
  if (indices.some(config => config.fields.some(field => field === 'id'))) {
    throw new RuntimeError('Cannot create an index with the id field');
  }
  return function (cls: Class<T>): void {
    ModelRegistryIndex.getForRegister(cls).register({ indices });
  };
}

/**
 * Model field decorator for denoting expiry date/time
 * @augments `@travetto/schema:Field`
 * @kind decorator
 */
export function ExpiresAt() {
  return <K extends string, T extends Partial<Record<K, Date>>>(instance: T, property: K): void => {
    ModelRegistryIndex.getForRegister(getClass(instance)).register({ expiresAt: property });
  };
}

/**
 * Model class decorator for pre-persist behavior
 * @augments `@travetto/schema:Schema`
 * @kind decorator
 */
export function PrePersist<T>(handler: DataHandler<T>, scope: PrePersistScope = 'all') {
  return function (cls: Class<T>): void {
    ModelRegistryIndex.getForRegister(cls).register({
      prePersist: [{
        scope,
        handler: castTo(handler)
      }]
    });
  };
}

/**
 * Model field decorator for pre-persist value setting
 * @augments `@travetto/schema:Field`
 * @kind decorator
 */
export function PersistValue<T>(handler: (current: T | undefined) => T, scope: PrePersistScope = 'all') {
  return function <K extends string, C extends Partial<Record<K, T>>>(instance: C, property: K): void {
    ModelRegistryIndex.getForRegister(getClass(instance)).register({
      prePersist: [{
        scope,
        handler: (inst): void => {
          const cInst: Record<K, T> = castTo(inst);
          cInst[property] = handler(cInst[property]);
        }
      }]
    });
  };
}

/**
 * Prevent a field from being persisted
 * @augments `@travetto/schema:Field`
 * @kind decorator
 */
export function Transient<T>() {
  return function <K extends string, C extends Partial<Record<K, T>>>(instance: C, property: K): void {
    ModelRegistryIndex.getForRegister(getClass(instance)).register({
      prePersist: [{
        scope: 'all',
        handler: (inst): void => {
          const cInst: Record<K, T> = castTo(inst);
          delete cInst[property];
        }
      }]
    });
  };
}

/**
 * Model class decorator for post-load behavior
 * @augments `@travetto/schema:Schema`
 * @kind decorator
 */
export function PostLoad<T>(handler: DataHandler<T>) {
  return function (cls: Class<T>): void {
    ModelRegistryIndex.getForRegister(cls).register({ postLoad: [castTo(handler)] });
  };
}