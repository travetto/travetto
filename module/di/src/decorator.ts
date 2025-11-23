import { castTo, type Class } from '@travetto/runtime';

import { InjectableCandidateConfig, ResolutionType, DiSchemaSymbol } from './types.ts';
import { DependencyRegistryIndex } from './registry/registry-index.ts';
import { SchemaRegistryIndex } from 'module/schema/__index__.ts';

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
export function Injectable(first?: Partial<InjectableCandidateConfig> | symbol, ...args: Partial<InjectableCandidateConfig>[]) {
  return <T extends Class>(target: T): T => {
    DependencyRegistryIndex.getForRegister(target).registerConstructor(...collapseConfig(first, args));
    return target;
  };
}

export type InjectConfig = { qualifier?: symbol, resolution?: ResolutionType };

/**
 * Indicate that a field is able to be injected
 */
export function Inject(first?: InjectConfig | symbol) {
  return (target: unknown, propertyKey?: string | symbol, idx?: number | PropertyDescriptor): void => {
    const config = typeof first === 'symbol' ? { qualifier: first } : first ?? {};
    if (typeof idx !== 'number') {
      SchemaRegistryIndex.getForRegister(target).registerFieldMetadata(propertyKey!, DiSchemaSymbol, config);
    } else {
      SchemaRegistryIndex.getForRegister(target).registerParameterMetadata(propertyKey!, idx, DiSchemaSymbol, config);
    }
  };
}

/**
 * Identifies a static method that is able to produce a dependency
 * @augments `@travetto/schema:Method`
 */
export function InjectableFactory(first?: Partial<InjectableCandidateConfig> | symbol, ...args: Partial<InjectableCandidateConfig>[]) {
  return <T extends Class>(target: T, property: string | symbol): void => {
    const config: Partial<InjectableCandidateConfig>[] = collapseConfig(first, args);
    DependencyRegistryIndex.getForRegister(target).registerFactory(property, ...config, ...args,);
  };
}