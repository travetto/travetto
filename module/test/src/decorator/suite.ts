import { Class } from '@encore2/registry';
import { TestRegistry } from '../service';
import { SuiteConfig } from '../model';

export function Suite(name?: string, extra?: Partial<SuiteConfig>) {
  return (target: Class<any>) => {
    TestRegistry.register(target, { name, ...(extra || {}) });
    return target;
  }
}

function listener(phase: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach') {
  return (inst: any, prop: string, descriptor: PropertyDescriptor) => {
    TestRegistry.registerPendingListener(inst.constructor, descriptor.value, phase);
    return descriptor;
  }
}

export const BeforeAll = listener('beforeAll');
export const BeforeEach = listener('beforeEach');
export const AfterAll = listener('afterAll');
export const AfterEach = listener('afterEach');