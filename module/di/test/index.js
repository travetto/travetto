require('@encore2/registry/bootstrap').init().then(x => {
  require('./simple-di');
});
