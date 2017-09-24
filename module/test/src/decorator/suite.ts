import { Class } from '@encore2/registry';
import { TestRegistry } from '../service';
import { SuiteConfig } from '../model';

export function Suite(name?: string, extra?: Partial<SuiteConfig>) {
  return (target: Class<any>) => {
    TestRegistry.register(target, { name, ...(extra || {}) });
    return target;
  }
}