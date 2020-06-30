process.env.TRV_ENV = 'prod';
process.env.TRV_ROOTS = 'alt/docs';

(async function () {
  const { PhaseManager } = require('@travetto/base/index.ts');
  await PhaseManager.init();
  const { LocationAware } = require('./custom-type-usage.ts');
  const { SchemaValidator } = require('../../../src/validate/validator.ts');

  const la = LocationAware.from({
    name: 'bob',
    // @ts-ignore
    point: 'red'
  });

  try {
    await SchemaValidator.validate(la);
  } catch (err) {
    console.log(err);
  }
})();

