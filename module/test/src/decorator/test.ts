import { Class } from '@encore2/registry';
import { TestRegistry } from '../service';

export function Test(description: string) {
  return (target: Class<any>, prop: string, descriptor: PropertyDescriptor) => {
    TestRegistry.registerMethod(target, descriptor.value, {
      description
    });
    return descriptor;
  }
}