import '@arcsine/nodesh';

import { Modules } from './package/modules';
import { Util } from './package/util';

const prep = (v: string): string => v.replace(Util.cwd, '').replace(/\/(module|related)\//, '');

['digraph g {'].$concat(
  ''.$map(() => Modules.graphByFolder)
    .$flatMap(v => Object.entries(v))
    .$flatMap(([k, v]) => [...v].map(x => [prep(k), prep(x)]))
    .$map(([src, dest]) => `"${dest}" -> "${src}";`),
  ['}']
)
  .$stdout;