/**
 * Initializes the logger to take over from base
 */
export const step = {
  key: '@trv:log/init',
  after: ['@trv:base/init'],
  before: ['@trv:config/init'],
  action: async (): Promise<void> => {
    const { Logger } = await import('../src/service');
    Logger.init();
  }
};