export const init = {
  priority: 100,
  action: () => {
    const { CacheManager } = require('../src/service/cache');
    const { Shutdown } = require('@travetto/base');
    Shutdown.onShutdown('Cache Manager', CacheManager.cleanup.bind(CacheManager));
  }
}