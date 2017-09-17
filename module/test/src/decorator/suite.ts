import { Class } from '@encore2/registry';
import { TestRegistry } from '../service';

export function Suite(description: string) {
  return (target: Class<any>) => {
    TestRegistry.register(target, { description });
    return target;
  }
}