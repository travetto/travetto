import { MetadataRegistry, Class } from '@travetto/registry';
import { SuiteConfig } from '../model/suite';
import { TestConfig } from '../model/test';

class $TestRegistry extends MetadataRegistry<SuiteConfig, TestConfig> {

  getValidClasses() {
    return this.getClasses().filter(c => !c.__abstract);
  }

  createPending(cls: Class): Partial<SuiteConfig> {
    return {
      class: cls,
      className: cls.__id.replace(/^@app./, '').replace(/^test[.]/, '').replace('#', '.'),
      file: cls.__file,
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
      file: cls.__file,
      methodName: fn.name
    };
  }

  registerPendingListener<T>(cls: Class<T>, listener: Function, phase: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach', ) {
    const suiteConfig = this.getOrCreatePending(cls)! as SuiteConfig;
    suiteConfig[phase].push(listener);
  }

  onInstallFinalize<T>(cls: Class<T>): SuiteConfig {
    const config = this.getOrCreatePending(cls) as SuiteConfig;
    const tests = [...this.pendingFields.get(cls.__id)!.values()];

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
      config.description = config.className;
    }
    for (const t of config.tests) {
      t.className = config.className;
    }
    return config;
  }

  getRunParams(file: string, clsName?: string, method?: string): { suites: SuiteConfig[] } | { suite: SuiteConfig, test?: TestConfig } {
    if (clsName && /^\d+$/.test(clsName)) { // If we only have a line number
      const line = parseInt(clsName, 10);
      const suites = this.getValidClasses().filter(f => f.__file === file).map(x => this.get(x)).filter(x => !x.skip);
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
          .filter(x => !x.class.__abstract);  // Do not run abstract suites
        return { suites };
      }
    }
  }
}

export const TestRegistry = new $TestRegistry();