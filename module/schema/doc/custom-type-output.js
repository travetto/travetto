process.env.TRV_ENV = 'prod';

(async function () {
  const { PhaseManager } = require('@travetto/base');
  await PhaseManager.init();
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

