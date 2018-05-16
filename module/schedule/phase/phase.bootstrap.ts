export const init = {
  priority: 100,
  action: () => {
    const { Shutdown } = require('@travetto/base');
    const { Scheduler } = require('../src/service/schedule');
    Shutdown.onShutdown('scheule.kill', () => Scheduler.kill());
  }
}