require('@travetto/base/main').run()
  .then(x => {
    require('./simpleReg');
    require('./simple');
  });
