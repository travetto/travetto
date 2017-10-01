let run = require('@travetto/registry/bootstrap').init()
  .then(x => {
    require('./simple-controller');
  }); 