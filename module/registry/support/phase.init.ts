/**
 * Initialize the registry after all files have been loaded
 */
export const init = {
  key: '@trv:registry/init',
  after: ['@trv:base/load'],
  action: async () => {
    const { RootRegistry } = await import('../src/service/root');
    return RootRegistry.init();
  }
};