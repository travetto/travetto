process.env.ENV = 'test';

require('@travetto/base/bootstrap').run()
  .then(x => require('./simple-config'));