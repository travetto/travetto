process.env.TRV_ENV = 'prod';
process.env.TRV_SRC_LOCAL = 'doc';

(async function () {
  const { PhaseManager } = await require('@travetto/base');
  await PhaseManager.run('init');
  const { validate } = await require('./person-binding-invalid.ts');
  try {
    await validate();
  } catch (err) {
    console.warn('Validation Failed', JSON.stringify(err, null, 2));
  }
})();