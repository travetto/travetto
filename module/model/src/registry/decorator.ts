import { Class } from '@travetto/base';

import { ModelType } from '../types/model';
import { ModelRegistry } from './model';
import { IndexConfig, ModelOptions } from './types';

/**
 * Model decorator, extends `@Schema`
 *
 * @augments `@trv:schema/Schema`
 */
export function Model(conf: Partial<ModelOptions<ModelType>> | string = {}) {
  return function <T extends ModelType, U extends Class<T>>(target: U): U {
    if (typeof conf === 'string') {
      conf = { store: conf };
    }
    ModelRegistry.register(target, conf);
    return target;
  };
}

/**
 * Defines an index on a model
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Index<T>(...indices: IndexConfig<any>[]) {
  return function (target: Class<T>): void {
    ModelRegistry.getOrCreatePending(target).indices!.push(...indices);
  };
}

/**
 * Model field decorator for denoting expiry date/time
 * @augments `@trv:schema/Field`
 */
export function ExpiresAt() {
  return <K extends string, T extends Partial<Record<K, Date>>>(tgt: T, prop: K): void => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ModelRegistry.register(tgt.constructor as Class<T>, { expiresAt: prop });
  };
}