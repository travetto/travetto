export const init = {
  after: 'base',
  key: 'schedule',
  action: async () => {
    const { Shutdown } = await import('@travetto/base');
    const { Scheduler } = await import('../src/service');
    Shutdown.onShutdown('schedule.kill', () => Scheduler.kill());
  }
};