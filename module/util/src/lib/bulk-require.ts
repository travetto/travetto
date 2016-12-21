import * as path from 'path';
let glob = require('glob');

export function bulkRequire(pattern: string, base: string | null = null, exclude?: (name: string) => boolean) {
  let search = `${base || process.cwd()}/${pattern}`;
  // console.log("Bulk Require", search);
  return (glob.sync(search) as string[])
    .map((f: string) => path.resolve(f))
    .filter(exclude || (() => true))
    // .map((x: string) => { console.log(x); return x; })
    .map(require);
}