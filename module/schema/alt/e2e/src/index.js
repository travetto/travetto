require('@travetto/boot/register');
require('@travetto/base')
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