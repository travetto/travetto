export const init = {
  key: 'test',
  before: ['compiler'],
  after: ['base'],
  action: async () => {
    const { Env } = await import('@travetto/base');
    if (Env.env === 'test' && Env.watch) { // If watching tests, pull them all in
      Env.mainAppFolders.push('test');
    }
  }
};