/**
 * Initializes the watch support
 */
export const init = {
  key: 'watch',
  before: ['config', 'compiler', 'registry'],
  after: 'base',
  action: async () => {
    const { WatchUtil } = await import('../src/util');
    WatchUtil.init();
  }
};