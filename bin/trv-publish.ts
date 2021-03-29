import '@arcsine/nodesh';

import { Modules } from './package/modules';
import { Packages } from './package/packages';

Modules.yieldPackagesJson().$parallel(([path, pkg]) =>
  Packages.showVersion(path, pkg.name, pkg.version)
    .$concat([path])
    .$first()
    .$notEmpty()
)
  .$stdout;