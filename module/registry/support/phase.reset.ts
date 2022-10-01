/**
 * Reset the registry, and it's children
 */
export const step = {
  key: '@trv:registry/reset',
  before: ['@trv:compiler/reset'],
  action: async (): Promise<void> => {
    const { RootRegistry } = await import('../src/service/root');
    await RootRegistry.reset();
  }
};