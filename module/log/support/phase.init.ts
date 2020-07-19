/**
 * Initializes the logger to take over from base
 */
export const init = {
  key: '@trv:log/init',
  after: ['@trv:base/init'],
  before: ['@trv:config/init'],
  action: async () => {
    const { Logger } = await import('../src/service');
    Logger.init();
  }
};