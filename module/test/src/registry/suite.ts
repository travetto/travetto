import { Class, Runtime, classConstruct, describeFunction, asFull, getUniqueId } from '@travetto/runtime';
import { MetadataRegistry } from '@travetto/registry';

import { SuiteConfig } from '../model/suite';
import { TestConfig, TestRun } from '../model/test';

/**
 * Test Suite registry
 */
class $SuiteRegistry extends MetadataRegistry<SuiteConfig, TestConfig> {

  /**
   * Find all valid tests (ignoring abstract)
   */
  getValidClasses(): Class[] {
    return this.getClasses().filter(c => !describeFunction(c).abstract);
  }

  createPending(cls: Class): Partial<SuiteConfig> {
    const lines = describeFunction(cls)?.lines;
    return {
      class: cls,
      classId: getUniqueId(cls),
      tags: [],
      import: Runtime.getImport(cls),
      lineStart: lines?.[0],
      lineEnd: lines?.[1],
      tests: [],
      beforeAll: [],
      beforeEach: [],
      afterAll: [],
      afterEach: []
    };
  }

  override createPendingField(cls: Class, fn: Function): Partial<TestConfig> {
    const lines = describeFunction(cls)?.methods?.[fn.name].lines;
    return {
      class: cls,
      tags: [],
      import: Runtime.getImport(cls),
      lineStart: lines?.[0],
      lineEnd: lines?.[1],
      lineBodyStart: lines?.[2],
      methodName: fn.name
    };
  }

  /**
   * Add a new phase listeners
   */
  registerPendingListener<T>(cls: Class<T>, listener: Function, phase: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach'): void {
    const suiteConfig = this.getOrCreatePending(cls);
    suiteConfig[phase]!.push(listener);
  }

  /**
   * On finalize, collapse state with super classes to create
   * a full projection of all listeners and tests.
   */
  onInstallFinalize<T>(cls: Class<T>): SuiteConfig {
    const config = asFull(this.getOrCreatePending(cls));
    const classId = getUniqueId(cls);
    const tests = [...this.pendingFields.get(classId)!.values()];

    const parent = this.getParentClass(cls);

    if (parent && this.has(parent)) {
      const pConf = this.get(parent);
      config.afterAll.push(...pConf.afterAll);
      config.beforeAll.push(...pConf.beforeAll);
      config.afterEach.push(...pConf.afterEach);
      config.beforeEach.push(...pConf.beforeEach);
      tests.push(...[...pConf.tests.values()].map(t => ({
        ...t,
        sourceImport: pConf.import,
        class: cls
      })));
    }

    config.instance = classConstruct(config.class);
    config.tests = tests!.map(x => asFull(x));
    config.description ||= config.classId;

    for (const t of config.tests) {
      t.classId = config.classId;
      t.import = config.import;
      t.tags = [...t.tags!, ...config.tags!];
    }
    return config;
  }

  /**
   * Get run parameters from provided input
   */
  getSuiteTests(run: TestRun): { suite: SuiteConfig, tests: TestConfig[] }[] {
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
        const cls = this.getValidClasses().find(x => getUniqueId(x) === clsId)!;
        const suite = this.get(cls);
        const tests = suite.tests.filter(x => methodNames.includes(x.methodName))!;
        return [{ suite, tests }];
      } else if (clsId) {
        const cls = this.getValidClasses().find(x => getUniqueId(x) === clsId)!;
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
  getByClassAndMethod(cls: Class, method: Function): TestConfig | undefined {
    if (this.has(cls)) {
      const conf = this.get(cls);
      return conf.tests.find(x => x.methodName === method.name);
    }
  }
}

export const SuiteRegistry = new $SuiteRegistry();