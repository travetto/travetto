export const init = {
  key: 'registry',
  after: 'compiler',
  action: async () => {
    const { RootRegistry } = await import('../src/service/root');
    return RootRegistry.init();
  }
};