import { ConfigManager } from '../src/manager';

/**
 * Initializes the config source
 */
export const step = {
  key: '@trv:config/init',
  after: ['@trv:base/init'],
  before: ['@trv:registry/init'],
  async action(): Promise<void> {
    await ConfigManager.init();
  }
};