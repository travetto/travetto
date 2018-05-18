require('@travetto/base/bin/travetto').run()
  .then(x => {
    require('./simple-controller');
    require('./weird-controller');
    //require('./model-controller')
  });