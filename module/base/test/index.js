require('../bin/travetto').run().then(x => {
  require('./stack');
  //  require('./watch');
  // require('./merge');
  require('./scan-app');
});