import { Class } from '@travetto/registry';
import { TestRegistry } from '../service';
import { TestConfig } from '../model';

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
    TestRegistry.registerMethod(inst.constructor, descriptor.value, {
      ...(extra || {}),
      file: inst.constructor.__filename,
      description: description as string
    });
    return descriptor;
  }
}