/**
 * Initializes the config source
 */
export const init = {
  key: '@trv:config/init',
  after: ['@trv:base/init'],
  action: async () => {
    const { ConfigManager } = await import('../src/manager');
    ConfigManager.init();
  }
};