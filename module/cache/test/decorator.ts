import { Class } from '@travetto/registry';
import { TestRegistry, SuiteConfig, TestRegistryUtil } from '@travetto/test';
import { MemoryCacheStore } from '../src/store/memory';
import { FileCacheStore } from '../src/store/file';

export function CacheSuite(config: Partial<SuiteConfig> = {}) {
  return function (target: any) {
    for (const el of [
      FileCacheStore,
      MemoryCacheStore
    ]) {
      const custom = TestRegistryUtil.customizeClass(target as Class, el, 'CacheStore');

      TestRegistry.register(custom, {
        beforeEach: [async function (this: any) {
          const store = new el();
          this.service.store = store;
          store.cullRate = 1000;
        }],
        ...config,
        description: `${custom.shortName} ${config.description || target.name} Suite`,
      });
    }
  };
}