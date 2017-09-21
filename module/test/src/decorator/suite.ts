import { Class } from '@encore2/registry';
import { TestRegistry } from '../service';

export function Suite(name?: string) {
  return (target: Class<any>) => {
    TestRegistry.register(target, { name });
    return target;
  }
}