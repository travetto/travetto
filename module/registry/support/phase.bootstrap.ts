export const init = {
  key: 'registry',
  after: 'compiler',
  action: () => require('../src/service/root').RootRegistry.init()
};