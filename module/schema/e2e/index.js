require('@travetto/base/bin/travetto')
  .run(x => {
    require('./watch');
    require('../src').SchemaRegistry.onFieldChange((e) => {
      console.log('Field', e);
    });
    require('../src').SchemaRegistry.onSchemaChange((e) => {
      console.log('Schema', e);
    });
  });