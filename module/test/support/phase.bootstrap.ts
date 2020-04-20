export const init = {
  key: 'test',
  before: ['compiler'],
  after: ['base'],
  action: async () => {
    const { Env, ScanApp } = await import('@travetto/base');
    if (Env.env === 'test') {
      // Remove extension from auto loading during test from modules
      ScanApp.modAppFolders.splice(ScanApp.modAppFolders.findIndex(x => x === 'extension'), 1);
      // Allow test modules to be searched
      ScanApp.modAppExclude.splice(ScanApp.modAppExclude.findIndex(x => x === 'test'), 1);
      // If watching, auto load all tests
      if (Env.watch) {
        ScanApp.mainAppFolders.push('test');
      }
    }
  }
};