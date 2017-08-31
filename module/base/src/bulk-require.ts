import * as path from 'path';
import * as glob from 'glob';

export function bulkRequire(pattern: string, base: string | null = null, exclude?: (name: string) => boolean) {
  let search = `${base || process.cwd()}/${pattern}`;
  // console.log("Bulk Require", search);
  return (glob.sync(search) as string[])
    .map((f: string) => path.resolve(f))
    .filter(exclude || (() => true))
    // .map((x: string) => { console.log(x); return x; })
    .map(require)
    .filter(x => !!x); //Return non-empty values
}