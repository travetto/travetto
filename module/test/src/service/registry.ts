import { MetadataRegistry, Class } from '@encore2/registry';
import { SuiteConfig, TestConfig } from '../model';
import { DependencyRegistry } from '@encore2/di';

class $TestRegistry extends MetadataRegistry<SuiteConfig, TestConfig> {

  createPending(cls: Class): Partial<SuiteConfig> {
    return {
      class: cls,
      className: cls.__id,
      tests: []
    };
  }

  createPendingMethod(cls: Class, fn: Function) {
    return {
      class: cls,
      className: cls.__id,
      method: fn.name
    }
  }

  onInstallFinalize<T>(cls: Class<T>): SuiteConfig {
    let config = this.getOrCreatePending(cls) as SuiteConfig;
    let tests = this.pendingMethods.get(cls.__id)!.values();
    config.instance = new config.class();
    config.tests = Array.from(tests) as TestConfig[];
    return config;
  }
}

export const TestRegistry = new $TestRegistry();