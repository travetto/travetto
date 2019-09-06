import { Class } from '@travetto/registry';
import { TestRegistry, SuiteConfig, TestRegistryUtil } from '@travetto/test';
import { MemoryCacheStore } from '../src/store/memory';
import { FileCacheStore } from '../src/store/file';
import { RedisCacheStore } from '../extension/redis.store';
import { CullableCacheStore, CacheStore } from '../src/store/types';

export function CacheSuite(config: Partial<SuiteConfig> = {}) {
  return function (target: any) {
    for (const el of [
      FileCacheStore,
      MemoryCacheStore,
      RedisCacheStore
    ] as Class<CacheStore>[]) {
      const custom = TestRegistryUtil.customizeClass(target as Class, el, 'CacheStore');

      TestRegistry.register(custom, {
        beforeEach: [async function (this: any) {
          const store = new el();
          this.service.store = store;
          if (store instanceof CullableCacheStore) {
            store.cullRate = 1000;
          }
          if (store.postConstruct) {
            await store.postConstruct();
          }
        }],
        afterEach: [async function (this: any) {
          if (this.service.store.clear) {
            await this.service.store.clear();
          }
        }],
        ...config,
        description: `${custom.shortName} ${config.description || target.name} Suite`,
      });
    }
  };
}