require('@travetto/base/bin/travetto').run()
  .then(() => {
    let ret = require('../src/service/app');
    console.log(ret);
  });
