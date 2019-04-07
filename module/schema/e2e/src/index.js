require('@travetto/boot/bin/init')
  .libRequire('@travetto/base')
  .PhaseManager.run()
  .then(() => {
    require('./watch');
    require('../src').SchemaRegistry.onFieldChange((e) => {
      console.log('Field', e);
    });
    require('../src').SchemaRegistry.onSchemaChange((e) => {
      console.log('Schema', e);
    });
  });