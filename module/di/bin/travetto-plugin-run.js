const TRV_DI_ROOT = !process.env.TRV_FRAMEWORK_DEV ? '..' :
  (process.cwd().includes('/module/di') ? process.cwd() :
    `${process.cwd()}/node_modules/@travetto/di`);

const { handleFailure, runApp } = require(`${TRV_DI_ROOT}/bin/lib`);
runApp(process.argv.slice(2)) // If loaded directly as main entry, run, idx 2 is where non-node arguments start at
  .catch(err => handleFailure(err, 1));