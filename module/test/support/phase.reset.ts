import { SuiteRegistry } from '../src/registry/suite';

/**
 * Handle test reset
 */
export const step = {
  key: '@trv:test/rest',
  before: ['@trv:registry/reset'],
  action: async (): Promise<void> => {
    // Clear the registry
    await SuiteRegistry.reset();
  }
};