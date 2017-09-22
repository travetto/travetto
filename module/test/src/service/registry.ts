import { MetadataRegistry, Class } from '@encore2/registry';
import { SuiteConfig, TestConfig } from '../model';

class $TestRegistry extends MetadataRegistry<SuiteConfig, TestConfig> {

  createPending(cls: Class): Partial<SuiteConfig> {
    return {
      class: cls,
      tests: []
    };
  }

  createPendingMethod(cls: Class, fn: Function) {
    return {
      class: cls,
      method: fn.name
    }
  }

  onInstallFinalize<T>(cls: Class<T>): SuiteConfig {
    let config = this.getOrCreatePending(cls) as SuiteConfig;
    let tests = this.pendingMethods.get(cls.__id)!.values();
    config.instance = new config.class();
    config.tests = Array.from(tests) as TestConfig[];
    if (!config.name) {
      config.name = cls.__id.split(':test.')[1].replace('#', '.');
    }
    for (let t of config.tests) {
      t.suiteName = config.name;
    }
    return config;
  }
}

export const TestRegistry = new $TestRegistry();