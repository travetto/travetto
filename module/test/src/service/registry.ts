import { MetadataRegistry, Class, ChangeEvent } from '@travetto/registry';
import { SuiteConfig, TestConfig } from '../model';

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

  createPendingMethod(cls: Class, fn: Function) {
    return {
      class: cls,
      file: cls.__filename,
      methodName: fn.name
    }
  }

  registerPendingListener<T>(cls: Class<T>, listener: Function, phase: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach', ) {
    const suiteConfig = this.getOrCreatePending(cls)! as SuiteConfig;
    suiteConfig[phase].push(listener);
  }

  onInstallFinalize<T>(cls: Class<T>): SuiteConfig {
    const config = this.getOrCreatePending(cls) as SuiteConfig;
    const tests = this.pendingMethods.get(cls.__id)!.values();
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
}

export const TestRegistry = new $TestRegistry();