import { Class } from '@travetto/registry';
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

export const BeforeAll = listener.bind(null, 'beforeAll');
export const BeforeEach = listener.bind(null, 'beforeEach');
export const AfterAll = listener.bind(null, 'afterAll');
export const AfterEach = listener.bind(null, 'afterEach');