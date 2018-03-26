import * as path from 'path';
import * as glob from 'glob';
import * as fs from 'fs';
import * as util from 'util';

const globAsync = util.promisify(
  glob as (name: string, options: glob.IOptions, callback: (err: any, res: string[]) => void) => void
) as (name: string, options: glob.IOptions) => Promise<string[]>;

const fsReadFileAsync = util.promisify(fs.readFile);

function findHandler(base?: string, exclude?: (name: string) => boolean) {
  base = base || process.cwd();

  return {
    config: {
      cwd: base,
      root: base,
    },
    match: (matches: string[]) => {
      let out = matches.map(f => path.resolve(f));
      if (exclude) {
        out = out.filter(x => !exclude(x));
      }
      // out.map((x: string) => { console.log(x); return x; })
      return out;
    }
  }
}

export function bulkFindSync(globs: string | string[], base?: string, exclude?: (name: string) => boolean) {
  const handler = findHandler(base, exclude);
  if (!Array.isArray(globs)) {
    globs = [globs];
  }
  return globs
    .map(pattern => handler.match(glob.sync(pattern, handler.config)))
    .reduce((acc, v) => acc.concat(v), []);
}

export async function bulkFind(globs: string | string[], base?: string, exclude?: (name: string) => boolean) {
  const handler = findHandler(base, exclude);
  if (!Array.isArray(globs)) {
    globs = [globs];
  }
  const promises = globs.map(pattern => globAsync(pattern, handler.config).then(handler.match));
  const all = await Promise.all(promises);
  return all.reduce((acc, v) => acc.concat(v), []);
}

export function bulkRequire<T = any>(globs: string | string[], base?: string, exclude?: (name: string) => boolean): T[] {
  return bulkFindSync(globs, base, exclude)
    .map(require)
    .filter(x => !!x); // Return non-empty values
}

export async function bulkRead(globs: string | string[], base?: string, exclude?: (name: string) => boolean) {
  const files = await bulkFind(globs, base, exclude);
  const promises = files.map((f: string) => fsReadFileAsync(f).then(x => ({ name: f, data: x.toString() })));
  return await Promise.all(promises);
}

export function bulkReadSync(pattern: string, base?: string, exclude?: (name: string) => boolean) {
  const files = bulkFindSync(pattern, base, exclude);
  return files.map(x => ({ name: x, data: fs.readFileSync(x).toString() }));
}