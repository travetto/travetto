import { Class, ClassInstance } from '@travetto/base';
import { SuiteRegistry } from '../registry/suite';
import { SuiteConfig } from '../model/suite';

export type SuitePhase = 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach';

/**
 * Register a class to be defined as a test suite, and a candidate for testing
 * @param description The Suite description
 * @augments `@trv:test/Suite`
 */
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

  return ((target: Class) => {
    const cfg = { description: (description as string), ...extra };
    if (target.ᚕabstract) {
      cfg.skip = true;
    }
    SuiteRegistry.register(target, cfg);
    return target;
  }) as ClassDecorator;
}

function listener(phase: SuitePhase) {
  return (inst: ClassInstance, prop: string, descriptor: PropertyDescriptor) => {
    SuiteRegistry.registerPendingListener(inst.constructor, descriptor.value, phase);
    return descriptor;
  };
}

/**
 * Registers function to run before any tests are run
 */
export const BeforeAll = listener.bind(null, 'beforeAll');
/**
 * Registers function to run before each test is run
 */
export const BeforeEach = listener.bind(null, 'beforeEach');
/**
 * Registers function to run after all tests are run
 */
export const AfterAll = listener.bind(null, 'afterAll');
/**
 * Registers function to run after each test is run
 */
export const AfterEach = listener.bind(null, 'afterEach');