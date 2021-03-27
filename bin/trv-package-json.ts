import '@arcsine/nodesh';
import { Packages } from './package/packages';

Packages.yieldPackagesJson()
  .$map(([a, v]) => Packages.writeOut(a, Packages.standardize(a, v)))
  .$console;