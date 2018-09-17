export const init = {
  key: 'cache',
  after: 'base',
  action: () => {
    const { CacheManager } = require('../src/service');
    const { Shutdown } = require('@travetto/base');
    Shutdown.onShutdown('Cache Manager', CacheManager.cleanup.bind(CacheManager));
  }
};