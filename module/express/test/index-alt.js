require('@travetto/base/bootstrap').run()
  .then(() => {
    let ret = require('../src/service/app');
    console.log(ret);
  });