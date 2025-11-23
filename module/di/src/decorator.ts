import { castTo, type Class } from '@travetto/runtime';

import { InjectableCandidate, ResolutionType } from './types.ts';
import { DependencyRegistryIndex } from './registry/registry-index.ts';

const collapseConfig = <T extends { qualifier?: symbol }>(first?: T | symbol, args: Partial<T>[] = []): Partial<T>[] => {
  const configs: Partial<T>[] = [];
  if (typeof first === 'symbol') {
    configs.push(castTo({ qualifier: first }));
  } else if (first) {
    configs.push(first);
  }
  return [...configs, ...args];
};

/**
 * Indicate that a class is able to be injected
 * @augments `@travetto/schema:Schema`
 */
export function Injectable(first?: Partial<InjectableCandidate> | symbol, ...args: Partial<InjectableCandidate>[]) {
  return <T extends Class>(target: T): T => {
    DependencyRegistryIndex.getForRegister(target).registerConstructor(...collapseConfig(first, args));
    return target;
  };
}

export type InjectConfig = { qualifier?: symbol, resolution?: ResolutionType };

/**
 * Indicate that a field or parameter is able to be injected
 */
export function Inject(first?: InjectConfig | symbol) {
  return (target: unknown, propertyKey: string | symbol, idx?: number | PropertyDescriptor): void => {
    const config = typeof first === 'symbol' ? { qualifier: first } : first ?? {};
    if (typeof idx !== 'number') {
      DependencyRegistryIndex.registerFieldMetadata(target, propertyKey, config);
    } else {
      DependencyRegistryIndex.registerParameterMetadata(target, propertyKey, idx, config);
    }
  };
}

/**
 * Identifies a static method that is able to produce a dependency
 * @augments `@travetto/schema:Method`
 */
export function InjectableFactory(first?: Partial<InjectableCandidate> | symbol, ...args: Partial<InjectableCandidate>[]) {
  return <T extends Class>(target: T, property: string | symbol): void => {
    const config: Partial<InjectableCandidate>[] = collapseConfig(first, args);
    DependencyRegistryIndex.getForRegister(target).registerFactory(property, ...config, ...args,);
  };
}