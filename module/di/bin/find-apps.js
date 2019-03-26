const TRV_DI_ROOT = !process.env.TRV_FRAMEWORK_DEV ? '..' :
  (process.cwd().includes('/module/di') ? process.cwd() :
    `${process.cwd()}/node_modules/@travetto/di`);

const { computeApps, handleFailure } = require(`${TRV_DI_ROOT}/bin/lib`);
computeApps()
  .then(resolved => require('fs').writeSync(1, `${JSON.stringify(resolved)}\n`))
  .catch(err => handleFailure(err, 1));