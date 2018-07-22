require('@travetto/base/bin/travetto').run()
  .then(x => {
    require('./relationship-controller');
    require('./user-controller');
  });