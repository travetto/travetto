/**
 * Initializes the config source
 */
export const init = {
  key: 'config',
  after: ['base'],
  action: async () => {
    const { ConfigManager } = await import('../src/manager');
    ConfigManager.init();
  }
};