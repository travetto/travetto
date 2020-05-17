/**
 * Registers the bind utilities on class
 */
export const init = {
  key: 'schema',
  after: ['registry'], // Should be global
  action: async () => {
    const { BindUtil } = await import('../src/bind-util');
    BindUtil.register();
  }
};