export const init = {
  key: 'config',
  after: 'base',
  action: () => require('../src/service/loader').ConfigLoader.initialize()
};