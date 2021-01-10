process.env.TRV_ENV = 'prod';

(async function () {
  const { PhaseManager } = await require('@travetto/base');
  await PhaseManager.init();
  const { Test } = await require('./person-binding.ts');
  console.log(Test());
})();