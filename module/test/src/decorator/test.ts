import { TestRegistry } from '../registry/registry';
import { TestConfig } from '../model/test';

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
      file: inst.constructor.__filename,
      description: description as string
    });
    return descriptor;
  };
}

export function ShouldThrow(state: TestConfig['shouldThrow']): MethodDecorator {
  return (inst: any, prop: string | symbol, descriptor: PropertyDescriptor) => {
    TestRegistry.registerField(inst.constructor, descriptor.value, { shouldThrow: state });
    return descriptor;
  };
}

export function Timeout(ms: number): MethodDecorator {
  return (inst: any, prop: string | symbol, descriptor: PropertyDescriptor) => {
    TestRegistry.registerField(inst.constructor, descriptor.value, { timeout: ms });
    return descriptor;
  };
}