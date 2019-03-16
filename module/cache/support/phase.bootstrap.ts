export const init = {
  key: 'cache',
  after: 'base',
  action: async () => {
    const { CacheManager } = await import('../src/service');
    const { Shutdown } = await import('@travetto/base');
    Shutdown.onShutdown('Cache Manager', CacheManager.cleanup.bind(CacheManager));
  }
};