export const init = {
  key: 'log',
  after: 'base',
  before: 'config',
  action: () => {
    const Logger = require('../src/service').Logger;
    Logger._init();
    require('@travetto/base/src/env').Env.error = (...args: any[]) => Logger.log('error', ...args);
  }
};