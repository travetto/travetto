import { Any, castTo, ClassInstance, type Class } from '@travetto/runtime';

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
  return <T extends Class>(cls: T): void => {
    DependencyRegistryIndex.getForRegister(cls).registerClass(...collapseConfig(first, args));
  };
}

export type InjectConfig = { qualifier?: symbol, resolution?: ResolutionType };

/**
 * Indicate that a field or parameter is able to be injected
 */
export function Inject(first?: InjectConfig | symbol) {
  return (instance: ClassInstance, property: string | symbol, idx?: number | PropertyDescriptor): void => {
    const config = typeof first === 'symbol' ? { qualifier: first } : first ?? {};
    if (typeof idx !== 'number') {
      DependencyRegistryIndex.registerFieldMetadata(instance.constructor, property, config);
    } else {
      DependencyRegistryIndex.registerParameterMetadata(instance.constructor, property, idx, config);
    }
  };
}

/**
 * Identifies a static method that is able to produce a dependency
 * @augments `@travetto/schema:Method`
 */
export function InjectableFactory(first?: Partial<InjectableCandidate> | symbol, ...args: Partial<InjectableCandidate>[]) {
  return <T extends Class>(cls: T, property: string | symbol, descriptor: TypedPropertyDescriptor<(...args: Any[]) => Any>): void => {
    const config = collapseConfig(first, args);
    DependencyRegistryIndex.getForRegister(cls).registerFactory(property, ...config, ...args, {
      factory: (...params: unknown[]) => descriptor.value!.apply(cls, params),
    });
  };
}