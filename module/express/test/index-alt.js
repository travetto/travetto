require('@travetto/base/bin/travetto').run()
  .then(() => {
    const ret = require('../src/service/app');
    console.log(ret);
  });