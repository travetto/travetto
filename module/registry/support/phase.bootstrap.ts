/**
 * Initialize the registry after all files have been loaded
 */
export const init = {
  key: 'registry',
  after: ['require-all'],
  action: async () => {
    const { RootRegistry } = await import('../src/service/root');
    return RootRegistry.init();
  }
};