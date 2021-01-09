require('@travetto/boot/register');
require('@travetto/base')
  .PhaseManager.init('@trv:schema/init')
  .then(() => {
    require('./watch');
    require('.').SchemaRegistry.onFieldChange((e) => {
      console.log('Field', { type: e.type, target: (e.curr ?? e.prev) });
    });
    require('.').SchemaRegistry.onSchemaChange((e) => {
      console.log('Schema', { type: e.type, target: (e.curr ?? e.prev).ᚕid });
    });
  });