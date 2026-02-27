import { castTo, type Class, type ClassInstance, describeFunction, getClass } from '@travetto/runtime';

import type { SuiteConfig } from '../model/suite.ts';
import { SuiteRegistryIndex } from '../registry/registry-index.ts';

/**
 * Register a class to be defined as a test suite, and a candidate for testing
 * @param description The Suite description
 * @augments `@travetto/schema:Schema`
 * @example opt-in
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
  return (instance: ClassInstance, property: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(getClass(instance)).register({
      phaseHandlers: [{ type: 'beforeAll', action: descriptor.value }]
    });
    return descriptor;
  };
}

/**
 * Registers function to run before each test is run
 * @kind decorator
 */
export function BeforeEach() {
  return (instance: ClassInstance, property: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(getClass(instance)).register({
      phaseHandlers: [{ type: 'beforeEach', action: descriptor.value }]
    });
    return descriptor;
  };
}

/**
 * Registers function to run after all tests are run
 * @kind decorator
 */
export function AfterAll() {
  return (instance: ClassInstance, property: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(getClass(instance)).register({
      phaseHandlers: [{ type: 'afterAll', action: descriptor.value }]
    });
    return descriptor;
  };
}

/**
 * Registers function to run after each test is run
 * @kind decorator
 */
export function AfterEach() {
  return (instance: ClassInstance, property: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    SuiteRegistryIndex.getForRegister(getClass(instance)).register({
      phaseHandlers: [{ type: 'afterEach', action: descriptor.value }]
    });
    return descriptor;
  };
}