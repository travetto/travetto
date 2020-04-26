require('@travetto/boot/bin/init')
  .libRequire('@travetto/base')
  .PhaseManager.bootstrap('schema')
  .then(() => {
    require('./watch');
    require('../src').SchemaRegistry.onFieldChange((e) => {
      console.log('Field', e);
    });
    require('../src').SchemaRegistry.onSchemaChange((e) => {
      console.log('Schema', e);
    });
  });