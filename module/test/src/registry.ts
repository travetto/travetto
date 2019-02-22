import { MetadataRegistry, Class } from '@travetto/registry';
import { SuiteConfig } from './model/suite';
import { TestConfig } from './model/test';

class $TestRegistry extends MetadataRegistry<SuiteConfig, TestConfig> {

  createPending(cls: Class): Partial<SuiteConfig> {
    return {
      class: cls,
      className: cls.__id.split(':')[1].replace(/^test[.]/, '').replace('#', '.'),
      file: cls.__filename,
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
      file: cls.__filename,
      methodName: fn.name
    };
  }

  registerPendingListener<T>(cls: Class<T>, listener: Function, phase: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach', ) {
    const suiteConfig = this.getOrCreatePending(cls)! as SuiteConfig;
    suiteConfig[phase].push(listener);
  }

  onInstallFinalize<T>(cls: Class<T>): SuiteConfig {
    const config = this.getOrCreatePending(cls) as SuiteConfig;
    const tests = this.pendingFields.get(cls.__id)!.values();
    const parent = this.getParentClass(cls);
    if (parent && this.has(parent)) {
      const pconf = this.get(parent);
      config.afterAll.push(...pconf.afterAll);
      config.beforeAll.push(...pconf.beforeAll);
      config.afterEach.push(...pconf.afterEach);
      config.beforeEach.push(...pconf.beforeEach);
    }
    config.instance = new config.class();
    config.tests = Array.from(tests) as TestConfig[];
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
      const suites = this.getClasses().filter(f => f.__filename === file).map(x => this.get(x));
      const suite = suites.find(x => x.lines && (line >= x.lines.start && line <= x.lines.end));

      if (suite) {
        const test = suite.tests.find(x => x.lines && (line >= x.lines.start && line <= x.lines.end));
        return test ? { suite, test } : { suite };
      } else {
        return { suites };
      }
    } else { // Else lookup directly
      if (method) {
        const cls = this.getClasses().find(x => x.name === clsName)!;
        const suite = this.get(cls);
        const test = suite.tests.find(x => x.methodName === method)!;
        return { suite, test };
      } else if (clsName) {
        const cls = this.getClasses().find(x => x.name === clsName)!;
        const suite = this.get(cls);
        return { suite };
      } else {
        const suites = this.getClasses().map(x => this.get(x));
        return { suites };
      }
    }
  }
}

export const TestRegistry = new $TestRegistry();