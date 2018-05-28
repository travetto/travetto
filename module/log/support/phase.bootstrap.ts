export const init = {
  priority: 0,
  action: () => {
    const Logger = require('../src/service').Logger;
    Logger._init();
    require('@travetto/base/src/env').AppEnv.error = (...args: any[]) => Logger.log('error', ...args);
  }
};