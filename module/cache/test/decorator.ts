import { Class } from '@travetto/registry';
import { TestRegistry, SuiteConfig, TestRegistryUtil } from '@travetto/test';
import { MemoryCacheStore } from '../src/store/memory';
import { FileCacheStore } from '../src/store/file';
import { RedisCacheStore } from '../extension/redis';
import { LocalCacheStore } from '../src/store/types';

export function CacheSuite(config: Partial<SuiteConfig> = {}) {
  return function (target: any) {
    for (const el of [
      FileCacheStore,
      MemoryCacheStore,
      RedisCacheStore
    ]) {
      const custom = TestRegistryUtil.customizeClass(target as Class, el, 'CacheStore');

      TestRegistry.register(custom, {
        beforeEach: [async function (this: any) {
          const store = new el();
          this.service.store = store;
          if (store instanceof LocalCacheStore) {
            store.cullRate = 1000;
          }
          if (store.postConstruct) {
            await store.postConstruct();
          }
        }],
        afterAll: [async function (this: any) {
          if (this.service.store.reset) {
            await this.service.store.reset();
          }
        }],
        ...config,
        description: `${custom.shortName} ${config.description || target.name} Suite`,
      });
    }
  };
}