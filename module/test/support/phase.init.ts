/**
 * Test initialization
 */
export const init = {
  key: '@trv:test/init',
  before: ['@trv:compiler/init'],
  after: ['@trv:base/init'],
  action: async () => {
    const { EnvUtil } = await import('@travetto/boot');
    const { ScanApp } = await import('@travetto/base');

    // If watching, allow auto load of all tests
    if (EnvUtil.isTrue('TRV_TEST_COMPILE')) {
      ScanApp.mainAppFolders.add('test');
    }
  }
};