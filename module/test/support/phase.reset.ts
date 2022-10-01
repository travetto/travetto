/**
 * Handle test reset
 */
export const step = {
  key: '@trv:test/rest',
  before: ['@trv:registry/reset'],
  action: async (): Promise<void> => {
    const { SuiteRegistry } = await import('../src/registry/suite');
    // Clear the registry
    await SuiteRegistry.reset();
  }
};