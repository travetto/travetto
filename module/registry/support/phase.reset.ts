// TODO: Document
export const init = {
  key: 'registry',
  before: ['compiler'],
  action: async () => {
    const { RootRegistry } = await import('../src/service/root');
    await RootRegistry.reset();
  }
};