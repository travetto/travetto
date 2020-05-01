// TODO: Document
export const init = {
  after: 'base',
  key: 'schedule',
  action: async () => {
    const { ShutdownManager } = await import('@travetto/base');
    const { Scheduler } = await import('../src/service');
    ShutdownManager.onShutdown('schedule.kill', () => Scheduler.kill());
  }
};