import { MetadataRegistry, Class } from '@travetto/registry';
import { SuiteConfig } from '../model/suite';
import { TestConfig } from '../model/test';

/**
 * Test Suite registry
 */
class $SuiteRegistry extends MetadataRegistry<SuiteConfig, TestConfig> {

  /**
   * Find all valid tests (ignoring abstract)
   */
  getValidClasses() {
    return this.getClasses().filter(c => !c.ᚕabstract);
  }

  createPending(cls: Class): Partial<SuiteConfig> {
    return {
      class: cls,
      classId: cls.ᚕid,
      file: cls.ᚕfile,
      tests: [],
      beforeAll: [],
      beforeEach: [],
      afterAll: [],
      afterEach: []
    };
  }

  createPendingField(cls: Class, fn: Function) {
    return {
      class: cls,
      file: cls.ᚕfile,
      methodName: fn.name
    };
  }

  /**
   * Add a new phase listeners
   */
  registerPendingListener<T>(cls: Class<T>, listener: Function, phase: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach',) {
    const suiteConfig = this.getOrCreatePending(cls)! as SuiteConfig;
    suiteConfig[phase].push(listener);
  }

  /**
   * On finalize, collapse state with super classes to create
   * a full projection of all listeners and tests.
   */
  onInstallFinalize<T>(cls: Class<T>): SuiteConfig {
    const config = this.getOrCreatePending(cls) as SuiteConfig;
    const tests = [...this.pendingFields.get(cls.ᚕid)!.values()];

    const parent = this.getParentClass(cls);

    if (parent && this.has(parent)) {
      const pconf = this.get(parent);
      config.afterAll.push(...pconf.afterAll);
      config.beforeAll.push(...pconf.beforeAll);
      config.afterEach.push(...pconf.afterEach);
      config.beforeEach.push(...pconf.beforeEach);
      tests.push(...[...pconf.tests.values()].map(t => ({
        ...t,
        class: cls
      })));
    }

    config.instance = new config.class();
    config.tests = tests as TestConfig[];

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
  getRunParams(file: string, clsName?: string, method?: string): { suites: SuiteConfig[] } | { suite: SuiteConfig, test?: TestConfig } {
    if (clsName && /^\d+$/.test(clsName)) { // If we only have a line number
      const line = parseInt(clsName, 10);
      const suites = this.getValidClasses().filter(f => f.ᚕfile === file).map(x => this.get(x)).filter(x => !x.skip);
      const suite = suites.find(x => x.lines && (line >= x.lines.start && line <= x.lines.end));

      if (suite) {
        const test = suite.tests.find(x => x.lines && (line >= x.lines.start && line <= x.lines.end));
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
          .filter(x => !x.class.ᚕabstract);  // Do not run abstract suites
        return { suites };
      }
    }
  }

  /**
   * Find a test configuration given class and optionally a method
   */
  getByClassAndMethod(cls: Class, method: Function) {
    if (this.has(cls)) {
      const conf = this.get(cls);
      return conf.tests.find(x => x.methodName === method.name);
    }
  }
}

export const SuiteRegistry = new $SuiteRegistry();