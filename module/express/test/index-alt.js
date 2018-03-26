require('@travetto/base/bootstrap')
  .then(() => {
    let ret = require('../src/service/app');
    console.log(ret);
  });