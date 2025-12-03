import { Any, castTo, ClassInstance, getClass, type Class } from '@travetto/runtime';
import { CONSTRUCTOR_PROPERTY } from '@travetto/schema';

import { InjectableCandidate, ResolutionType } from './types.ts';
import { DependencyRegistryIndex } from './registry/registry-index.ts';

const fromInput = <T extends { qualifier?: symbol }>(input?: T | symbol): T =>
  typeof input === 'symbol' ? castTo({ qualifier: input }) : (input ?? castTo<T>({}));

/**
 * Indicate that a class is able to be injected
 * @augments `@travetto/schema:Schema`
 * @kind decorator
 */
export function Injectable(input?: Partial<InjectableCandidate> | symbol) {
  return <T extends Class>(cls: T): void => {
    DependencyRegistryIndex.getForRegister(cls).registerClass(fromInput(input));
  };
}

export type InjectConfig = { qualifier?: symbol, resolution?: ResolutionType };

/**
 * Indicate that a field or parameter is able to be injected
 * @augments `@travetto/di:Inject`
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Inject(input?: InjectConfig | symbol) {
  return (instanceOrCls: Class | ClassInstance, property?: string, idx?: number | PropertyDescriptor): void => {
    const config = fromInput(input);
    const cls = getClass(instanceOrCls);
    const propertyKey = property ?? CONSTRUCTOR_PROPERTY;
    if (typeof idx !== 'number') {
      DependencyRegistryIndex.registerFieldMetadata(cls, propertyKey, config);
    } else {
      DependencyRegistryIndex.registerParameterMetadata(cls, propertyKey, idx, config);
    }
  };
}

/**
 * Identifies a static method that is able to produce a dependency
 * @augments `@travetto/schema:Method`
 * @kind decorator
 */
export function InjectableFactory(input?: Partial<InjectableCandidate> | symbol) {
  return <T extends Class>(cls: T, property: string, descriptor: TypedPropertyDescriptor<(...args: Any[]) => Any>): void => {
    DependencyRegistryIndex.getForRegister(cls).registerFactory(property, fromInput(input), {
      factory: (...params: unknown[]) => descriptor.value!.apply(cls, params),
    });
  };
}