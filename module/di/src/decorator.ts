import { castTo, TypedFunction, type Class } from '@travetto/runtime';

import { InjectableClassConfig, ResolutionType, InjectableFactoryConfig } from './types.ts';
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
 *
 * @augments `@travetto/schema:Schema`
 */
export function Injectable(first?: Partial<InjectableClassConfig> | symbol, ...args: Partial<InjectableClassConfig>[]) {
  return <T extends Class>(target: T): T => {
    DependencyRegistryIndex.getForRegister(target).registerInjectable(...collapseConfig(first, args));
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
      DependencyRegistryIndex.getForRegister(target).registerInjectable({ fields: { [propertyKey!]: config } });
    } else {
      DependencyRegistryIndex.getForRegister(target).registerInjectable({ constructorParameters: [{ index: idx, ...config }] });
    }
  };
}

/**
 * Identifies a static method that is able to produce a dependency
 * @augments `@travetto/schema:Method`
 */
export function InjectableFactory(first?: Partial<InjectableFactoryConfig> | symbol, ...args: Partial<InjectableFactoryConfig>[]) {
  return <T extends Class>(target: T, property: string | symbol, descriptor: TypedPropertyDescriptor<TypedFunction>): void => {
    const config: Partial<InjectableFactoryConfig>[] = collapseConfig(first, args);
    config.push({ handle: descriptor.value! });

    // Create mock cls for DI purposes
    const id = `${target.Ⲑid}#${property.toString()}`;
    const fnClass = class { static Ⲑid = id; };

    DependencyRegistryIndex.getForRegister(fnClass).registerFactory(property, ...config, ...args,);
  };
}