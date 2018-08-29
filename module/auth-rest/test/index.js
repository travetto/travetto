const a = require('@travetto/base/bin/bootstrap').run().then(() => {
  require('./complete/simple');
});