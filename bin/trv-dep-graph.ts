import '@arcsine/nodesh';
import { PathUtil } from '@travetto/boot/src';
import { Modules } from './package/modules';

const prep = (v: string) => v.replace(PathUtil.cwd, '').replace(/\/(module|related)\//, '');

['digraph g {'].$concat(
  ''.$map(() => Modules.graph)
    .$flatMap(v => Object.entries(v))
    .$flatMap(([k, v]) => [...v].map(x => [prep(k), prep(x)]))
    .$map(([src, dest]) => `"${dest}" -> "${src}";`),
  ['}']
)
  .$stdout;