/**
 * Initializes the config source
 */
export const step = {
  key: '@trv:config/init',
  after: ['@trv:base/init'],
  before: ['@trv:registry/init'],
  async action(): Promise<void> {
    const { ConfigManager } = await import('../src/manager');
    await ConfigManager.init();
  }
};