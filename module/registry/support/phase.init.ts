import { RootRegistry } from '../src/service/root';

/**
 * Initialize the registry after all files have been loaded
 */
export const step = {
  key: '@trv:registry/init',
  after: ['@trv:boot/load'],
  action: async (): Promise<unknown> => {
    return RootRegistry.init();
  }
};