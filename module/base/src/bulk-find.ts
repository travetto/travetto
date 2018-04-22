import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

const fsReadFileAsync = util.promisify(fs.readFile);
const fsStat = util.promisify(fs.lstat);
const fsReaddir = util.promisify(fs.readdir);

export interface Entry {
  full: string;
  relative: string;
  stats: fs.Stats;
}

export interface Handler {
  root: string;
  returnDir?: boolean;
  include: (stat: Entry) => boolean;
}

export function Handler(include: (stat: Entry) => boolean, root?: string, dirs = false): Handler {
  return {
    root: root || process.cwd(),
    include,
    returnDir: dirs
  }
}

export function buildEntryFromFile(file: string, root: string) {
  const relative = file.replace(`${root}${path.sep}`, '');
  const full = `${root}${path.sep}${relative}`;
  return {
    relative,
    full,
    stats: fs.statSync(file)
  }
}
export function scanDir(handler: Handler, relativeBase = '', fullBase = handler.root) {
  return new Promise<Entry[]>(async (resolve, reject) => {
    try {
      let out: Entry[] = [];
      for (const file of (await fsReaddir(fullBase))) {
        const relative = relativeBase ? `${relativeBase}${path.sep}${file}` : file;
        const full = `${fullBase}/${path.sep}/${file}`;
        const stats = await fsStat(full);
        const entry = { stats, full, relative };

        if (stats.isDirectory()) {
          out = out.concat(await scanDir(handler, relative, full));
        }
        if ((!stats.isDirectory() || handler.returnDir) && handler.include(entry)) {
          out.push(entry);
        }
      }
      resolve(out);
    } catch (e) {
      reject(e);
    }
  })
}

export function scanDirSync(handler: Handler, relativeBase = '', fullBase = handler.root) {
  let out: Entry[] = [];
  for (const file of fs.readdirSync(fullBase)) {
    const relative = relativeBase ? `${relativeBase}${path.sep}${file}` : file;
    const full = `${fullBase}/${path.sep}/${file}`;
    const stats = fs.lstatSync(full);
    const entry = { stats, full, relative };

    if (stats.isDirectory()) {
      out = out.concat(scanDirSync(handler, relative, full));
    }
    if ((!stats.isDirectory() || handler.returnDir) && handler.include(entry)) {
      out.push(entry);
    }
  }
  return out;
}

export function bulkFindSync(handlers: Handler[]) {
  return handlers.map(x => scanDirSync(x))
    .reduce((acc, v) => acc.concat(v), [])
    .map(y => y.full);
}

export async function bulkFind(handlers: Handler[]) {
  const promises = handlers.map(x => scanDir(x));
  const all = await Promise.all(promises);
  return all.reduce((acc, v) => acc.concat(v), []).map(x => x.full);
}

export function bulkRequire<T = any>(handlers: Handler[]): T[] {
  return bulkFindSync(handlers)
    .map(require)
    .filter(x => !!x); // Return non-empty values
}

export async function bulkRead(handlers: Handler[]) {
  const files = await bulkFind(handlers);
  const promises = files.map((f: string) => fsReadFileAsync(f).then(x => ({ name: f, data: x.toString() })));
  return await Promise.all(promises);
}

export function bulkReadSync(handlers: Handler[]) {
  const files = bulkFindSync(handlers);
  return files.map(x => ({ name: x, data: fs.readFileSync(x).toString() }));
}