process.env.TRV_ENV = 'prod';
process.env.TRV_SRC_LOCAL = 'doc';

(async function () {
  const { PhaseManager } = await require('@travetto/base');
  await PhaseManager.run('init');
  const { Test } = await require('./person-binding.ts');
  console.log(Test());
})();