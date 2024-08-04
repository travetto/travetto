import { Class } from '@travetto/runtime';
import { SchemaRegistry } from '@travetto/schema';

import { ModelType } from '../types/model';
import { ModelRegistry } from './model';
import { DataHandler, IndexConfig, ModelOptions, PrePersistScope } from './types';

/**
 * Model decorator, extends `@Schema`
 *
 * @augments `@travetto/schema:Schema`
 */
export function Model(conf: Partial<ModelOptions<ModelType>> | string = {}) {
  return function <T extends ModelType, U extends Class<T>>(target: U): U {
    if (typeof conf === 'string') {
      conf = { store: conf };
    }
    ModelRegistry.register(target, conf);
    SchemaRegistry.register(target, { baseType: conf.baseType });
    return target;
  };
}

/**
 * Defines an index on a model
 */
export function Index<T extends ModelType>(...indices: IndexConfig<T>[]) {
  return function (target: Class<T>) {
    ModelRegistry.getOrCreatePending(target).indices!.push(...indices);
  };
}

/**
 * Model field decorator for denoting expiry date/time
 * @augments `@travetto/schema:Field`
 */
export function ExpiresAt() {
  return <K extends string, T extends Partial<Record<K, Date>>>(tgt: T, prop: K): void => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ModelRegistry.register(tgt.constructor as Class<T>, { expiresAt: prop });
  };
}

/**
 * Model class decorator for pre-persist behavior
 */
export function PrePersist<T>(handler: DataHandler<T>, scope: PrePersistScope = 'all') {
  return function (tgt: Class<T>): void {
    ModelRegistry.registerDataHandlers(tgt, {
      prePersist: [{
        scope,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        handler: handler as DataHandler
      }]
    });
  };
}

/**
 * Model field decorator for pre-persist value setting
 */
export function PersistValue<T>(handler: (curr: T | undefined) => T, scope: PrePersistScope = 'all') {
  return function <K extends string, C extends Partial<Record<K, T>>>(tgt: C, prop: K): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ModelRegistry.registerDataHandlers(tgt.constructor as Class<C>, {
      prePersist: [{
        scope,
        handler: (inst): void => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const cInst = (inst as unknown as Record<K, T>);
          cInst[prop] = handler(cInst[prop]);
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ModelRegistry.registerDataHandlers(tgt, { postLoad: [handler as DataHandler] });
  };
}