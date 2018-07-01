const a = require('@travetto/base/bin/travetto').run().then(() => {
  require('./complete/simple');
});