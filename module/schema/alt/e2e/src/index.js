require('@travetto/boot/bin/init')
  .libRequire('@travetto/base')
  .PhaseManager.bootstrap('schema')
  .then(() => {
    require('./watch');
    require('.').SchemaRegistry.onFieldChange((e) => {
      console.log('Field', e);
    });
    require('.').SchemaRegistry.onSchemaChange((e) => {
      console.log('Schema', e);
    });
  });