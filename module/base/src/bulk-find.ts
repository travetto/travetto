import * as path from 'path';
import * as glob from 'glob';
import * as fs from 'fs';

function findHandler(base?: string, exclude?: (name: string) => boolean) {
  base = base || process.cwd();

  return {
    config: {
      cwd: base!,
      root: base!,
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
  let handler = findHandler(base, exclude);
  if (!Array.isArray(globs)) {
    globs = [globs];
  }
  return globs
    .map(pattern => handler.match(glob.sync(pattern, handler.config)))
    .reduce((acc, v) => acc.concat(v), []);
}

export async function bulkFind(globs: string | string[], base?: string, exclude?: (name: string) => boolean) {
  let handler = findHandler(base, exclude);
  if (!Array.isArray(globs)) {
    globs = [globs];
  }
  let promises = globs.map(pattern =>
    new Promise<string[]>((resolve, reject) => {
      glob(pattern, handler.config, (err, matches) => {
        if (err) {
          reject(err);
        } else {
          resolve(handler.match(matches))
        }
      });
    })
  );
  let all = await Promise.all(promises);
  return all.reduce((acc, v) => acc.concat(v), []);
}

export function bulkRequire(globs: string | string[], base?: string, exclude?: (name: string) => boolean) {
  return bulkFindSync(globs, base, exclude)
    .map(require)
    .filter(x => !!x); // Return non-empty values
}

export async function bulkRead(globs: string | string[], base?: string, exclude?: (name: string) => boolean) {
  let files = await bulkFind(globs, base, exclude);
  let promises = files.map(f => {
    return new Promise<{ name: string, data: string }>((resolve, reject) => {
      return fs.readFile(f, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve({ name: f, data: data.toString() });
        }
      })
    })
  });
  return await Promise.all(promises);
}

export function bulkReadSync(pattern: string, base?: string, exclude?: (name: string) => boolean) {
  let files = bulkFindSync(pattern, base, exclude);
  return files.map(x => ({ name: x, data: fs.readFileSync(x).toString() }));
}