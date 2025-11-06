import { AppError, asConstructable, castTo, Class } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ModelType } from '../types/model.ts';
import { DataHandler, IndexConfig, ModelConfig, PrePersistScope } from './types.ts';
import { ModelRegistryIndex } from './registry-index.ts';

/**
 * Model decorator, extends `@Schema`
 *
 * @augments `@travetto/schema:Schema`
 */
export function Model(conf: Partial<ModelConfig<ModelType>> | string = {}) {
  return function <T extends ModelType, U extends Class<T>>(target: U): U {
    if (typeof conf === 'string') {
      conf = { store: conf };
    }
    ModelRegistryIndex.getForRegister(target).register(conf);
    SchemaRegistryIndex.getForRegister(target).register({ baseType: conf.baseType });
    return target;
  };
}

/**
 * Defines an index on a model
 */
export function Index<T extends ModelType>(...indices: IndexConfig<T>[]) {
  if (indices.some(x => x.fields.some(f => f === 'id'))) {
    throw new AppError('Cannot create an index with the id field');
  }
  return function (target: Class<T>): void {
    ModelRegistryIndex.getForRegister(target).register({ indices });
  };
}

/**
 * Model field decorator for denoting expiry date/time
 * @augments `@travetto/schema:Field`
 */
export function ExpiresAt() {
  return <K extends string, T extends Partial<Record<K, Date>>>(tgt: T, prop: K): void => {
    ModelRegistryIndex.getForRegister(asConstructable(tgt).constructor).register({ expiresAt: prop });
  };
}

/**
 * Model class decorator for pre-persist behavior
 */
export function PrePersist<T>(handler: DataHandler<T>, scope: PrePersistScope = 'all') {
  return function (tgt: Class<T>): void {
    ModelRegistryIndex.getForRegister(tgt).register({
      prePersist: [{
        scope,
        handler: castTo(handler)
      }]
    });
  };
}

/**
 * Model field decorator for pre-persist value setting
 */
export function PersistValue<T>(handler: (curr: T | undefined) => T, scope: PrePersistScope = 'all') {
  return function <K extends string, C extends Partial<Record<K, T>>>(tgt: C, prop: K): void {
    ModelRegistryIndex.getForRegister(asConstructable(tgt).constructor).register({
      prePersist: [{
        scope,
        handler: (inst): void => {
          const cInst: Record<K, T> = castTo(inst);
          cInst[prop] = handler(cInst[prop]);
        }
      }]
    });
  };
}

/**
 * Prevent a field from being persisted
 */
export function Transient<T>() {
  return function <K extends string, C extends Partial<Record<K, T>>>(tgt: C, prop: K): void {
    ModelRegistryIndex.getForRegister(asConstructable(tgt).constructor).register({
      prePersist: [{
        scope: 'all',
        handler: (inst): void => {
          const cInst: Record<K, T> = castTo(inst);
          delete cInst[prop];
        }
      }]
    });
  };
}

/**
 * Model class decorator for post-load behavior
 */
export function PostLoad<T>(handler: DataHandler<T>) {
  return function (tgt: Class<T>): void {
    ModelRegistryIndex.getForRegister(tgt).register({ postLoad: [castTo(handler)] });
  };
}