import { castTo, Class, ClassInstance, describeFunction, getClass } from '@travetto/runtime';

import { SuiteConfig } from '../model/suite.ts';
import { SuiteRegistryIndex } from '../registry/registry-index.ts';

export type SuitePhase = 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach';

/**
 * Register a class to be defined as a test suite, and a candidate for testing
 * @param description The Suite description
 * @augments `@travetto/schema:Schema`
 * @kind decorator
 */
export function Suite(): ClassDecorator;
export function Suite(...rest: Partial<SuiteConfig>[]): ClassDecorator;
export function Suite(description: string, ...rest: Partial<SuiteConfig>[]): ClassDecorator;
export function Suite(description?: string | Partial<SuiteConfig>, ...rest: Partial<SuiteConfig>[]): ClassDecorator {
  const decorator = (cls: Class): typeof cls => {
    const isAbstract = describeFunction(cls).abstract;
    SuiteRegistryIndex.getForRegister(cls).register(
      ...(typeof description !== 'string' && description ? [description] : []),
      ...rest,
      ...isAbstract ? [{ skip: true }] : [],
      ...(typeof description === 'string' ? [{ description }] : []),
    );
    return cls;
  };

  return castTo(decorator);
}

/**
 * Registers function to run before any tests are run
 * @kind decorator
 */
export function BeforeAll() {
  return (instance: ClassInstance, property: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(getClass(instance)).register({ beforeAll: [descriptor.value] });
    return descriptor;
  };
}

/**
 * Registers function to run before each test is run
 * @kind decorator
 */
export function BeforeEach() {
  return (instance: ClassInstance, property: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(getClass(instance)).register({ beforeEach: [descriptor.value] });
    return descriptor;
  };
}

/**
 * Registers function to run after all tests are run
 * @kind decorator
 */
export function AfterAll() {
  return (instance: ClassInstance, property: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(getClass(instance)).register({ afterAll: [descriptor.value] });
    return descriptor;
  };
}

/**
 * Registers function to run after each test is run
 * @kind decorator
 */
export function AfterEach() {
  return (instance: ClassInstance, property: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(getClass(instance)).register({ afterEach: [descriptor.value] });
    return descriptor;
  };
}