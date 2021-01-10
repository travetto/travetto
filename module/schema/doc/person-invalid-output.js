process.env.TRV_ENV = 'prod';

(async function () {
  const { PhaseManager } = await require('@travetto/base/index.ts');
  await PhaseManager.init();
  const { validate } = await require('./person-binding-invalid.ts');
  try {
    await validate();
  } catch (err) {
    console.warn('Validation Failed', JSON.stringify(err, null, 2));
  }
})();