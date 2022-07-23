/**
 * Initializes the config source
 */
export const init = {
  key: '@trv:config/init',
  before: ['@trv:registry/init'],
  async action(): Promise<void> {
    const { ConfigManager } = await import('../src/manager');
    await ConfigManager.init();
  }
};