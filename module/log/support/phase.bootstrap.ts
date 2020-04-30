// TODO: Document
export const init = {
  key: 'log',
  after: 'base',
  before: 'config',
  action: async () => {
    const { Logger } = await import('../src/service');
    Logger.init();
  }
};