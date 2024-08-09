import { Class, ConcreteClass, Runtime, describeFunction, impartial, impartialArray } from '@travetto/runtime';
import { MetadataRegistry } from '@travetto/registry';

import { SuiteConfig } from '../model/suite';
import { TestConfig } from '../model/test';

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
      classId: cls.Ⲑid,
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
    const config = impartial(this.getOrCreatePending(cls));
    const tests = [...this.pendingFields.get(cls.Ⲑid)!.values()];

    const parent = this.getParentClass(cls);

    if (parent && this.has(parent)) {
      const pConf = this.get(parent);
      config.afterAll.push(...pConf.afterAll);
      config.beforeAll.push(...pConf.beforeAll);
      config.afterEach.push(...pConf.afterEach);
      config.beforeEach.push(...pConf.beforeEach);
      tests.push(...[...pConf.tests.values()].map(t => ({
        ...t,
        class: cls
      })));
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    config.instance = new (config.class as ConcreteClass)();
    config.tests = impartialArray(tests!);

    if (!config.description) {
      config.description = config.classId;
    }
    for (const t of config.tests) {
      t.classId = config.classId;
    }
    return config;
  }

  /**
   * Get run parameters from provided input
   */
  getRunParams(imp: string, clsName?: string, method?: string): { suites: SuiteConfig[] } | { suite: SuiteConfig, test?: TestConfig } {
    if (clsName && /^\d+$/.test(clsName)) { // If we only have a line number
      const line = parseInt(clsName, 10);
      const suites = this.getValidClasses()
        .filter(cls => Runtime.getImport(cls) === imp)
        .map(x => this.get(x)).filter(x => !x.skip);
      const suite = suites.find(x => line >= x.lineStart && line <= x.lineEnd);

      if (suite) {
        const test = suite.tests.find(x => line >= x.lineStart && line <= x.lineEnd);
        return test ? { suite, test } : { suite };
      } else {
        return { suites };
      }
    } else { // Else lookup directly
      if (method) {
        const cls = this.getValidClasses().find(x => x.name === clsName)!;
        const suite = this.get(cls);
        const test = suite.tests.find(x => x.methodName === method)!;
        return { suite, test };
      } else if (clsName) {
        const cls = this.getValidClasses().find(x => x.name === clsName)!;
        const suite = this.get(cls);
        return { suite };
      } else {
        const suites = this.getValidClasses()
          .map(x => this.get(x))
          .filter(x => !describeFunction(x.class).abstract);  // Do not run abstract suites
        return { suites };
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