require('@travetto/base/bin/travetto').run().then(() => {
  console.log('Howdy');
  require('./app');
});