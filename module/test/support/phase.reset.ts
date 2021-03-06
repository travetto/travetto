/**
 * Handle test reset
 */
export const init = {
  key: '@trv:test/rest',
  before: ['@trv:registry/reset'],
  action: async () => {
    const { SuiteRegistry } = await import('../src/registry/suite');
    // Clear the registry
    await SuiteRegistry.reset();
  }
};