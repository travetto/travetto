import { Class } from '@travetto/registry';
import { TestRegistry } from '../service';
import { SuiteConfig } from '../model';

export type SuitePhase = 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach';

export function Suite(): ClassDecorator;
export function Suite(...rest: Partial<SuiteConfig>[]): ClassDecorator;
export function Suite(description: string, ...rest: Partial<SuiteConfig>[]): ClassDecorator;
export function Suite(description?: string | Partial<SuiteConfig>, ...rest: Partial<SuiteConfig>[]): ClassDecorator {
  const extra: Partial<SuiteConfig> = {};

  if (description && typeof description !== 'string') {
    Object.assign(extra, description);
    description = extra.description;
  }

  for (const r of rest) {
    Object.assign(extra, r);
  }

  return (target: Class<any>) => {
    TestRegistry.register(target, { description: (description as string), ...extra });
    return target;
  }
}

function listener(phase: SuitePhase) {
  return (inst: any, prop: string, descriptor: PropertyDescriptor) => {
    TestRegistry.registerPendingListener(inst.constructor, descriptor.value, phase);
    return descriptor;
  }
}

export const BeforeAll = listener.bind(null, 'beforeAll');
export const BeforeEach = listener.bind(null, 'beforeEach');
export const AfterAll = listener.bind(null, 'afterAll');
export const AfterEach = listener.bind(null, 'afterEach');