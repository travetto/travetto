import { castTo, Class, ClassInstance, describeFunction } from '@travetto/runtime';

import { SuiteRegistry } from '../registry/suite.ts';
import { SuiteConfig } from '../model/suite.ts';

export type SuitePhase = 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach';

/**
 * Register a class to be defined as a test suite, and a candidate for testing
 * @param description The Suite description
 * @augments `@travetto/test:Suite`
 */
export function Suite(): ClassDecorator;
export function Suite(...rest: Partial<SuiteConfig>[]): ClassDecorator;
export function Suite(description: string, ...rest: Partial<SuiteConfig>[]): ClassDecorator;
export function Suite(description?: string | Partial<SuiteConfig>, ...rest: Partial<SuiteConfig>[]): ClassDecorator {
  const extra: Partial<SuiteConfig> = {};
  const descriptionString = description && typeof description !== 'string' ?
    Object.assign(extra, description).description :
    description;

  for (const r of rest) {
    Object.assign(extra, r);
  }

  const dec = (target: Class): typeof target => {
    const cfg = { description: descriptionString, ...extra };
    if (describeFunction(target).abstract) {
      cfg.skip = true;
    }
    SuiteRegistry.register(target, cfg);
    return target;
  };

  return castTo(dec);
}

function listener(phase: SuitePhase) {
  return (inst: ClassInstance, prop: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
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