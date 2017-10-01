require('@travetto/registry/bootstrap')
  .init().then(x => {
    require('./models');
  })