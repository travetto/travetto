export const init = {
  key: 'registry',
  action: async () => {
    const { RootRegistry } = await import('../src/service/root');
    await RootRegistry.reset();
  }
};