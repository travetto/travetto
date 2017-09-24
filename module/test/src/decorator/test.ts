import { Class } from '@encore2/registry';
import { TestRegistry } from '../service';
import { TestConfig } from '../model';

export function Test(description?: string, extra?: Partial<TestConfig>) {
  return (inst: any, prop: string, descriptor: PropertyDescriptor) => {
    TestRegistry.registerMethod(inst.constructor, descriptor.value, {
      ...(extra || {}),
      description
    });
    return descriptor;
  }
}