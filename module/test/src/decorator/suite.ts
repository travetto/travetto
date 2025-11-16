import { castTo, Class, ClassInstance, describeFunction } from '@travetto/runtime';

import { SuiteConfig } from '../model/suite.ts';
import { SuiteRegistryIndex } from '../registry/registry-index.ts';

export type SuitePhase = 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach';

/**
 * Register a class to be defined as a test suite, and a candidate for testing
 * @param description The Suite description
 * @augments `@travetto/schema:Schema`
 */
export function Suite(): ClassDecorator;
export function Suite(...rest: Partial<SuiteConfig>[]): ClassDecorator;
export function Suite(description: string, ...rest: Partial<SuiteConfig>[]): ClassDecorator;
export function Suite(description?: string | Partial<SuiteConfig>, ...rest: Partial<SuiteConfig>[]): ClassDecorator {
  const dec = (target: Class): typeof target => {
    const isAbstract = describeFunction(target).abstract;
    SuiteRegistryIndex.getForRegister(target).register(
      ...(typeof description !== 'string' && description ? [description] : []),
      ...rest,
      ...isAbstract ? [{ skip: true }] : [],
      ...(typeof description === 'string' ? [{ description }] : []),
    );
    return target;
  };

  return castTo(dec);
}

/**
 * Registers function to run before any tests are run
 */
export function BeforeAll() {
  return (inst: ClassInstance, prop: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(inst.constructor).register(descriptor.value, { beforeAll: [descriptor.value] });
    return descriptor;
  };
}

/**
 * Registers function to run before each test is run
 */
export function BeforeEach() {
  return (inst: ClassInstance, prop: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(inst.constructor).register(descriptor.value, { beforeEach: [descriptor.value] });
    return descriptor;
  };
}

/**
 * Registers function to run after all tests are run
 */
export function AfterAll() {
  return (inst: ClassInstance, prop: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(inst.constructor).register(descriptor.value, { afterAll: [descriptor.value] });
    return descriptor;
  };
}

/**
 * Registers function to run after each test is run
 */
export function AfterEach() {
  return (inst: ClassInstance, prop: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(inst.constructor).register(descriptor.value, { afterEach: [descriptor.value] });
    return descriptor;
  };
}