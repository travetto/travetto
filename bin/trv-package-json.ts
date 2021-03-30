import '@arcsine/nodesh';
import { Packages } from './package/packages';

Packages.yieldPackages()
  .$parallel(async a => Packages.writeOut(Packages.standardize(a)))
  .$value;