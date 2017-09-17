import { MetadataRegistry, Class } from '@encore2/registry';
import { SuiteConfig, TestConfig } from '../model';
import { DependencyRegistry } from '@encore2/di';

class $TestRegistry extends MetadataRegistry<SuiteConfig, TestConfig> {

  createPending(cls: Class): Partial<SuiteConfig> {
    return {
      class: cls
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
    config.instance = new config.class();
    return config;
  }
}

export const TestRegistry = new $TestRegistry();