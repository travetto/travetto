require('@travetto/base/bin/travetto').run()
  .then(x => {
    require('./simple-controller');
    require('./simple-controller.1');
    require('./weird-controller');
    //require('./model-controller')
  });