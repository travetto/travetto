require('@travetto/base/bin/travetto').run()
  .then(x => {
    require('./simpleReg');
    require('./simple');
  });