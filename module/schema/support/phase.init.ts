import { BindUtil } from '../src/bind-util';

/**
 * Registers the bind utilities on class
 */
export const step = {
  key: '@trv:schema/init',
  after: ['@trv:registry/init'], // Should be global
  action: async (): Promise<void> => {
    BindUtil.register();
  }
};