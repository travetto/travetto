/**
 * Reset the registry, and it's children
 */
export const init = {
  key: 'registry',
  before: ['compiler'],
  action: async () => {
    const { RootRegistry } = await import('../src/service/root');
    await RootRegistry.reset();
  }
};