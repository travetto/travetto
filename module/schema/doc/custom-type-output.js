process.env.TRV_ENV = 'prod';
process.env.TRV_SRC_LOCAL = 'doc';

(async function () {
  const { PhaseManager } = require('@travetto/base');
  await PhaseManager.run('init');
  const { LocationAware } = require('./custom-type-usage.ts');
  const { SchemaValidator } = require('../src/validate/validator.ts');

  const la = LocationAware.from({
    name: 'bob',
    // @ts-ignore
    point: 'red'
  });

  try {
    await SchemaValidator.validate(LocationAware, la);
  } catch (err) {
    console.warn('Validation Failed', JSON.stringify(err, null, 2));
  }
})();

