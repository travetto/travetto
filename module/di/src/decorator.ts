import { Any, castTo, ClassInstance, getClass, type Class } from '@travetto/runtime';

import { InjectableCandidate, ResolutionType } from './types.ts';
import { DependencyRegistryIndex } from './registry/registry-index.ts';

const fromArg = <T extends { qualifier?: symbol }>(arg?: T | symbol): T =>
  typeof arg === 'symbol' ? castTo({ qualifier: arg }) : (arg ?? castTo<T>({}));

/**
 * Indicate that a class is able to be injected
 * @augments `@travetto/schema:Schema`
 */
export function Injectable(config?: Partial<InjectableCandidate> | symbol) {
  return <T extends Class>(cls: T): void => {
    DependencyRegistryIndex.getForRegister(cls).registerClass(fromArg(config));
  };
}

export type InjectConfig = { qualifier?: symbol, resolution?: ResolutionType };

/**
 * Indicate that a field or parameter is able to be injected
 * @augments `@travetto/di:Inject`
 * @augments `@travetto/schema:Input`
 */
export function Inject(config?: InjectConfig | symbol) {
  return (instanceOrCls: Class | ClassInstance, property?: string | symbol, idx?: number | PropertyDescriptor): void => {
    const cfg = fromArg(config);
    const cls = getClass(instanceOrCls);
    const propertyKey = property ?? 'CONSTRUCTOR';
    if (typeof idx !== 'number') {
      DependencyRegistryIndex.registerFieldMetadata(cls, propertyKey, cfg);
    } else {
      DependencyRegistryIndex.registerParameterMetadata(cls, propertyKey, idx, cfg);
    }
  };
}

/**
 * Identifies a static method that is able to produce a dependency
 * @augments `@travetto/schema:Method`
 */
export function InjectableFactory(config?: Partial<InjectableCandidate> | symbol) {
  return <T extends Class>(cls: T, property: string | symbol, descriptor: TypedPropertyDescriptor<(...args: Any[]) => Any>): void => {
    DependencyRegistryIndex.getForRegister(cls).registerFactory(property, fromArg(config), {
      factory: (...params: unknown[]) => descriptor.value!.apply(cls, params),
    });
  };
}