import { RuntimeError, type Class, Runtime, describeFunction } from '@travetto/runtime';
import { type RegistryIndex, RegistryIndexStore, Registry } from '@travetto/registry';

import type { SuiteConfig } from '../model/suite.ts';
import type { TestConfig, TestRun } from '../model/test.ts';
import { SuiteRegistryAdapter } from './registry-adapter.ts';

const sortedTests = (config: SuiteConfig): TestConfig[] =>
  Object.values(config.tests).toSorted((a, b) => a.lineStart - b.lineStart);

type SuiteTests = { suite: SuiteConfig, tests: TestConfig[] };

/**
 * Test Suite registry
 */
export class SuiteRegistryIndex implements RegistryIndex {

  static #instance = Registry.registerIndex(this);

  static getForRegister(cls: Class): SuiteRegistryAdapter {
    return this.#instance.store.getForRegister(cls);
  }

  static getTestConfig(cls: Class, method: Function | string): TestConfig | undefined {
    return this.#instance.getTestConfig(cls, method);
  }

  static getSuiteTests(run: TestRun): SuiteTests[] {
    return this.#instance.getSuiteTests(run);
  }

  static getConfig(cls: Class): SuiteConfig {
    return this.#instance.store.get(cls).get();
  }

  static getClasses(): Class[] {
    return this.#instance.store.getClasses();
  }

  static hasConfig(cls: Class): boolean {
    return this.#instance.store.has(cls);
  }

  store = new RegistryIndexStore(SuiteRegistryAdapter);

  /** @private */ constructor(source: unknown) { Registry.validateConstructor(source); }

  /**
   * Find all valid tests (ignoring abstract)
   */
  getValidClasses(): Class[] {
    return this.store.getClasses().filter(cls => !describeFunction(cls).abstract);
  }

  getConfig(cls: Class): SuiteConfig {
    return this.store.get(cls).get();
  }

  /**
   * Get run parameters from provided input
   */
  getSuiteTests(run: TestRun): SuiteTests[] {
    const clsId = run.classId;
    const imp = run.import;
    const methodNames = run.methodNames ?? [];

    if (clsId && /^\d+$/.test(clsId)) { // If we only have a line number
      const line = parseInt(clsId, 10);
      const suites = this.getValidClasses()
        .filter(cls => Runtime.getImport(cls) === imp)
        .map(cls => this.getConfig(cls))
        .filter(config => !config.skip);
      const suite = suites.find(config => line >= config.lineStart && line <= config.lineEnd);

      if (suite) {
        const tests = sortedTests(suite);
        const test = tests.find(config => line >= config.lineStart && line <= config.lineEnd);
        return test ? [{ suite, tests: [test] }] : [{ suite, tests }];
      } else {
        return suites.map(config => ({ suite: config, tests: sortedTests(config) }));
      }
    } else { // Else lookup directly
      if (methodNames.length) {
        const cls = this.getValidClasses().find(type => type.Ⲑid === clsId);
        if (!cls) {
          throw new RuntimeError('Unable to find suite for class ID', { details: { classId: clsId } });
        }
        const suite = this.getConfig(cls);
        const tests = sortedTests(suite).filter(config => methodNames.includes(config.methodName));
        return [{ suite, tests }];
      } else if (clsId) {
        const cls = this.getValidClasses().find(type => type.Ⲑid === clsId)!;
        if (!cls) {
          throw new RuntimeError('Unable to find suite for class ID', { details: { classId: clsId } });
        }
        const suite = this.getConfig(cls);
        return suite ? [{ suite, tests: sortedTests(suite) }] : [];
      } else {
        const suites = this.getValidClasses()
          .map(type => this.getConfig(type))
          .filter(config => !describeFunction(config.class).abstract);  // Do not run abstract suites
        return suites.map(config => ({ suite: config, tests: sortedTests(config) }));
      }
    }
  }

  /**
   * Find a test configuration given class and optionally a method
   */
  getTestConfig(cls: Class, method: Function | string): TestConfig | undefined {
    if (this.store.has(cls)) {
      const config = this.getConfig(cls);
      const methodName = typeof method === 'string' ? method : method.name;
      return Object.values(config.tests).find(item => item.methodName === methodName);
    }
  }
}