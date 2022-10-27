import { Logger } from '../src/service';

/**
 * Initializes the logger to take over from base
 */
export const step = {
  key: '@trv:log/init',
  after: ['@trv:base/init'],
  before: ['@trv:config/init'],
  action: async (): Promise<void> => {
    Logger.init();
  }
};