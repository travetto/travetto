// TODO: Document
export const init = {
  key: 'registry',
  after: 'require-all',
  action: async () => {
    const { RootRegistry } = await import('../src/service/root');
    return RootRegistry.init();
  }
};