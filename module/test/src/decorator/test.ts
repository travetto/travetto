import { Class } from '@encore2/registry';
import { TestRegistry } from '../service';

export function Test(description?: string) {
  return (inst: any, prop: string, descriptor: PropertyDescriptor) => {
    TestRegistry.registerMethod(inst.constructor, descriptor.value, {
      description
    });
    return descriptor;
  }
}