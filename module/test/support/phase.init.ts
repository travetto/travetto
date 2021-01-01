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

    // If we should treat test as source files (pre-compile, watching)
    if (EnvUtil.isTrue('TRV_TEST_COMPILE')) {
      ScanApp.mainAppFolders.add('test-support');
      ScanApp.mainAppFolders.add('test');
    }
  }
};