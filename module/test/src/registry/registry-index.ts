import { Class, Runtime, describeFunction } from '@travetto/runtime';
import { ChangeEvent, ClassOrId, RegistryIndex, RegistryV2 } from '@travetto/registry';

import { SuiteConfig } from '../model/suite.ts';
import { TestConfig, TestRun } from '../model/test.ts';
import { SuiteRegistryAdapter } from './registry-adapter.ts';

type SuiteTests = { suite: SuiteConfig, tests: TestConfig[] };

/**
 * Test Suite registry
 */
export class SuiteRegistryIndex implements RegistryIndex<SuiteConfig> {

  static getForRegister(clsOrId: ClassOrId): SuiteRegistryAdapter {
    return RegistryV2.getForRegister(this, clsOrId);
  }

  static has(cls: Class): boolean {
    return RegistryV2.has(SuiteRegistryIndex, cls);
  }

  static getTestConfig(cls: Class, method: Function): TestConfig | undefined {
    return RegistryV2.instance(SuiteRegistryIndex).getTestConfig(cls, method);
  }

  static getSuiteTests(run: TestRun): SuiteTests[] {
    return RegistryV2.instance(SuiteRegistryIndex).getSuiteTests(run);
  }

  static getConfig(cls: Class): SuiteConfig {
    return RegistryV2.get(SuiteRegistryIndex, cls).get();
  }

  adapter(cls: Class): SuiteRegistryAdapter {
    return new SuiteRegistryAdapter(cls);
  }

  process(_events: ChangeEvent<Class>[]): void {
    // No-op for now
  }

  get(target: Class): SuiteConfig {
    return RegistryV2.get(SuiteRegistryIndex, target).get();
  }

  has(target: Class): boolean {
    return RegistryV2.has(SuiteRegistryIndex, target);
  }

  /**
   * Find all valid tests (ignoring abstract)
   */
  getValidClasses(): Class[] {
    return RegistryV2.getClasses(SuiteRegistryIndex).filter(c => !describeFunction(c).abstract);
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
        .map(x => this.get(x)).filter(x => !x.skip);
      const suite = suites.find(x => line >= x.lineStart && line <= x.lineEnd);

      if (suite) {
        const test = suite.tests.find(x => line >= x.lineStart && line <= x.lineEnd);
        return test ? [{ suite, tests: [test] }] : [{ suite, tests: suite.tests }];
      } else {
        return suites.map(x => ({ suite: x, tests: x.tests }));
      }
    } else { // Else lookup directly
      if (methodNames.length) {
        const cls = this.getValidClasses().find(x => x.Ⲑid === clsId)!;
        const suite = this.get(cls);
        const tests = suite.tests.filter(x => methodNames.includes(x.methodName))!;
        return [{ suite, tests }];
      } else if (clsId) {
        const cls = this.getValidClasses().find(x => x.Ⲑid === clsId)!;
        const suite = this.get(cls);
        return suite ? [{ suite, tests: suite.tests }] : [];
      } else {
        const suites = this.getValidClasses()
          .map(x => this.get(x))
          .filter(x => !describeFunction(x.class).abstract);  // Do not run abstract suites
        return suites.map(x => ({ suite: x, tests: x.tests }));
      }
    }
  }

  /**
   * Find a test configuration given class and optionally a method
   */
  getTestConfig(cls: Class, method: Function): TestConfig | undefined {
    if (this.has(cls)) {
      const conf = this.get(cls);
      return conf.tests.find(x => x.methodName === method.name);
    }
  }
}