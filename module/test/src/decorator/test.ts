import { TestRegistry } from '../registry/registry';
import { TestConfig } from '../model/test';

/**
 * The `@Test` decorator register a test to be run as part of the enclosing suite.
 * @param description The test description
 * @augments trv/test/Test
 */
export function Test(): MethodDecorator;
export function Test(...rest: Partial<TestConfig>[]): MethodDecorator;
export function Test(description: string, ...rest: Partial<TestConfig>[]): MethodDecorator;
export function Test(description?: string | Partial<TestConfig>, ...rest: Partial<TestConfig>[]): MethodDecorator {
  const extra: Partial<TestConfig> = {};
  if (description && typeof description !== 'string') {
    Object.assign(extra, description);
    description = extra.description || undefined;
  }
  for (const r of rest) {
    Object.assign(extra, r);
  }
  return (inst: any, prop: string | symbol, descriptor: PropertyDescriptor) => {
    TestRegistry.registerField(inst.constructor, descriptor.value, {
      ...extra,
      file: inst.constructor.__file,
      description: description as string
    });
    return descriptor;
  };
}

/**
 * Marks a method as should throw to indicate a lack of throwing is a problem
 * @param state The parameters to use for checking if the response is valid
 */
export function ShouldThrow(state: TestConfig['shouldThrow']): MethodDecorator {
  return (inst: any, prop: string | symbol, descriptor: PropertyDescriptor) => {
    TestRegistry.registerField(inst.constructor, descriptor.value, { shouldThrow: state });
    return descriptor;
  };
}

/**
 * Sets the full timeout window for a given test
 * @param ms Max time to wait
 */
export function Timeout(ms: number): MethodDecorator {
  return (inst: any, prop: string | symbol, descriptor: PropertyDescriptor) => {
    TestRegistry.registerField(inst.constructor, descriptor.value, { timeout: ms });
    return descriptor;
  };
}