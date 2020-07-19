/**
 * Handle test reset
 */
export const init = {
  key: '@trv:test/rest',
  before: ['@trv:registry/reset'],
  action: async () => {
    const { TestRegistry } = await import('../src/registry/registry');
    // Clear the registry
    await TestRegistry.reset();
  }
};