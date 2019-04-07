const cwd = process.cwd();
require('@travetto/boot/bin/init');

const TRV_DI_ROOT = !process.env.TRV_FRAMEWORK_DEV ? '..' :
  (cwd.includes('/module/di') ? cwd : `${cwd}/node_modules/@travetto/di`);

require(`${TRV_DI_ROOT}/bin/lib`).findApps();