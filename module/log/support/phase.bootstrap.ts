export const init = {
  key: 'log',
  after: 'base',
  before: 'config',
  action: async () => {
    const { Logger } = await import('../src/service');
    Logger.init();
    const { Env } = await import('@travetto/base');
    Env.error = (Logger.log as (level: 'error') => void).bind(Logger, 'error');
  }
};