export const init = {
  key: 'log',
  after: 'base',
  before: 'config',
  action: async () => {
    const { Logger } = await import('../src/service');
    Logger._init();
    const { Env } = await import('@travetto/base');
    Env.error = (msg: string, ...args: any[]) => Logger.log('error', msg, ...args);
  }
};