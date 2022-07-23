/**
 * Registers the bind utilities on class
 */
export const init = {
  key: '@trv:schema/init',
  after: ['@trv:registry/init'], // Should be global
  action: async (): Promise<void> => {
    const { BindUtil } = await import('../src/bind-util');
    BindUtil.register();
  }
};