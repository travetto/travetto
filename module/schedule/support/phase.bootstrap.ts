// TODO: Document
export const init = {
  key: 'schedule',
  after: ['base'],
  action: async () => {
    const { ShutdownManager } = await import('@travetto/base');
    const { Scheduler } = await import('../src/service');
    ShutdownManager.onShutdown('schedule.kill', () => Scheduler.kill());
  }
};