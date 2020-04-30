// TODO: Document
export const init = {
  key: 'config',
  after: 'base',
  action: async () => {
    const { ConfigSource } = await import('../src/source');
    ConfigSource.init();
  }
};