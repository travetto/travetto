import { AppError, Class, Runtime, describeFunction } from '@travetto/runtime';
import { ChangeEvent, RegistryIndex, RegistryIndexStore, Registry } from '@travetto/registry';

import { SuiteConfig } from '../model/suite.ts';
import { TestConfig, TestRun } from '../model/test.ts';
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

  static has(cls: Class): boolean {
    return this.#instance.store.has(cls);
  }

  static getTestConfig(cls: Class, method: Function): TestConfig | undefined {
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

  store = new RegistryIndexStore(SuiteRegistryAdapter);

  process(_events: ChangeEvent<Class>[]): void {
    // No-op for now
  }

  /**
   * Find all valid tests (ignoring abstract)
   */
  getValidClasses(): Class[] {
    return this.store.getClasses().filter(c => !describeFunction(c).abstract);
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
        .map(x => this.getConfig(x)).filter(x => !x.skip);
      const suite = suites.find(x => line >= x.lineStart && line <= x.lineEnd);

      if (suite) {
        const tests = sortedTests(suite);
        const test = tests.find(x => line >= x.lineStart && line <= x.lineEnd);
        return test ? [{ suite, tests: [test] }] : [{ suite, tests }];
      } else {
        return suites.map(x => ({ suite: x, tests: sortedTests(x) }));
      }
    } else { // Else lookup directly
      if (methodNames.length) {
        const cls = this.getValidClasses().find(x => x.Ⲑid === clsId);
        if (!cls) {
          throw new AppError('Unable to find suite for class ID', { details: { classId: clsId } });
        }
        const suite = this.getConfig(cls);
        const tests = sortedTests(suite).filter(x => methodNames.includes(x.methodName));
        return [{ suite, tests }];
      } else if (clsId) {
        const cls = this.getValidClasses().find(x => x.Ⲑid === clsId)!;
        if (!cls) {
          throw new AppError('Unable to find suite for class ID', { details: { classId: clsId } });
        }
        const suite = this.getConfig(cls);
        return suite ? [{ suite, tests: sortedTests(suite) }] : [];
      } else {
        const suites = this.getValidClasses()
          .map(x => this.getConfig(x))
          .filter(x => !describeFunction(x.class).abstract);  // Do not run abstract suites
        return suites.map(x => ({ suite: x, tests: sortedTests(x) }));
      }
    }
  }

  /**
   * Find a test configuration given class and optionally a method
   */
  getTestConfig(cls: Class, method: Function): TestConfig | undefined {
    if (this.store.has(cls)) {
      const config = this.getConfig(cls);
      return Object.values(config.tests).find(x => x.methodName === method.name);
    }
  }
}