import { ClassInstance } from '@travetto/base';

import { SuiteRegistry } from '../registry/suite';
import { TestConfig } from '../model/test';

/**
 * The `@AssertCheck` indicates that a function's assert calls should be transformed
 */
export function AssertCheck(): MethodDecorator {
  return (inst: ClassInstance, prop: string | symbol, descriptor: PropertyDescriptor) => descriptor;
}

/**
 * The `@Test` decorator register a test to be run as part of the enclosing suite.
 * @param description The test description
 * @augments `@trv:test/Test`
 * @augments `@trv:test/AssertCheck`
 */
export function Test(): MethodDecorator;
export function Test(...rest: Partial<TestConfig>[]): MethodDecorator;
export function Test(description: string, ...rest: Partial<TestConfig>[]): MethodDecorator;
export function Test(description?: string | Partial<TestConfig>, ...rest: Partial<TestConfig>[]): MethodDecorator {
  const extra: Partial<TestConfig> = {};
  const descriptionString = (description && typeof description !== 'string') ?
    Object.assign(extra, description).description :
    description;

  for (const r of rest) {
    Object.assign(extra, r);
  }
  return (inst: ClassInstance, prop: string | symbol, descriptor: PropertyDescriptor) => {
    SuiteRegistry.registerField(inst.constructor, descriptor.value, {
      ...extra,
      file: inst.constructor.Ⲑsource,
      description: descriptionString
    });
    return descriptor;
  };
}

/**
 * Marks a method as should throw to indicate a lack of throwing is a problem
 * @param state The parameters to use for checking if the response is valid
 */
export function ShouldThrow(state: TestConfig['shouldThrow']): MethodDecorator {
  return (inst: ClassInstance, prop: string | symbol, descriptor: PropertyDescriptor) => {
    SuiteRegistry.registerField(inst.constructor, descriptor.value, { shouldThrow: state });
    return descriptor;
  };
}

/**
 * Sets the full timeout window for a given test
 * @param ms Max time to wait
 */
export function Timeout(ms: number): MethodDecorator {
  return (inst: ClassInstance, prop: string | symbol, descriptor: PropertyDescriptor) => {
    SuiteRegistry.registerField(inst.constructor, descriptor.value, { timeout: ms });
    return descriptor;
  };
}