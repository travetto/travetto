require('@travetto/base/bin/travetto').run()
  .then(x => {
    require('./watch');
    require('../src').SchemaRegistry.onFieldChange((e) => {
      console.log(e);
    });
  });