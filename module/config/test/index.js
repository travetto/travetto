process.env.ENV = 'test';

require('@travetto/base/bin/travetto').run()
  .then(x => require('./simple-config'));
