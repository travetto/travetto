/**
 * Handle test reset
 */
export const init = {
  key: 'test',
  before: ['registry'],
  action: async () => {
    const { TestRegistry } = await import('../src/registry/registry');
    // Clear the registry
    await TestRegistry.reset();
  }
};