require('@travetto/base/bootstrap').run()
  .then(x => {
    require('./simple-controller');
    require('./weird-controller')
  });