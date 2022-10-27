import { RootRegistry } from '../src/service/root';

/**
 * Reset the registry, and it's children
 */
export const step = {
  key: '@trv:registry/reset',
  before: ['@trv:compiler/reset'],
  action: async (): Promise<void> => {
    await RootRegistry.reset();
  }
};