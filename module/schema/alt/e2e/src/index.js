require('@travetto/boot/bin/init')
  .libRequire('@travetto/base')
  .PhaseManager.init('schema')
  .then(() => {
    require('./watch');
    require('.').SchemaRegistry.onFieldChange((e) => {
      console.log('Field', e);
    });
    require('.').SchemaRegistry.onSchemaChange((e) => {
      console.log('Schema', e);
    });
  });