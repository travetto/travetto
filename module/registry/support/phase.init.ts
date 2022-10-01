/**
 * Initialize the registry after all files have been loaded
 */
export const step = {
  key: '@trv:registry/init',
  after: ['@trv:base/load'],
  action: async (): Promise<unknown> => {
    const { RootRegistry } = await import('../src/service/root');
    return RootRegistry.init();
  }
};