/**
 * Test Bootstrapping
 */
export const init = {
  key: 'test',
  before: ['compiler'],
  after: ['base'],
  action: async () => {
    const { EnvUtil } = await import('@travetto/boot');
    const { Env, ScanApp } = await import('@travetto/base');

    // Only apply if we are running tests
    if (Env.env === 'test') {
      // Allow test module to be searched
      ScanApp.modAppExclude.splice(ScanApp.modAppExclude.findIndex(x => x === 'test'), 1);
      // If watching, allow auto load of all tests
      if (EnvUtil.isTrue('TRV_TEST_COMPILE')) {
        ScanApp.mainAppFolders.push('test');
      }
    }
  }
};