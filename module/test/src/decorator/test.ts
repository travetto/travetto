import { Class } from '@travetto/registry';
import { TestRegistry } from '../service';
import { TestConfig } from '../model';

export function Test(): MethodDecorator;
export function Test(description: string, extra?: Partial<TestConfig>): MethodDecorator;
export function Test(extra: Partial<TestConfig>): MethodDecorator;
export function Test(description?: string | Partial<TestConfig>, extra?: Partial<TestConfig>): MethodDecorator {
  if (description && typeof description !== 'string') {
    extra = extra ? {...description, ...extra} : extra;
    description = extra.description || undefined;
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