process.env.ENV = 'test';

require('@travetto/base/main').run()
  .then(x => require('./simple-config'));
