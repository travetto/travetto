require('@encore/base/bootstrap');
require('@encore/config').ConfigLoader.initialize()
  .then(x => require('./simple-di'));
