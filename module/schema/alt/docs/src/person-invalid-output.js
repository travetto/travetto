process.env.TRV_ENV = 'prod';
process.env.TRV_ROOTS = 'alt/docs';

(async function () {
  const { PhaseManager } = await require('@travetto/base/index.ts');
  await PhaseManager.init();
  const { validate } = await require('./person-binding-invalid.ts');
  try {
    await validate();
  } catch (err) {
    console.error('Failed to validate', { error: err, age: 20 });
  }
})();