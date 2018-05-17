import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

const fsReadFileAsync = util.promisify(fs.readFile);
const fsStat = util.promisify(fs.lstat);
const fsReaddir = util.promisify(fs.readdir);
const fsUnlink = util.promisify(fs.unlink);

export interface Entry {
  file: string;
  stats: fs.Stats;
  children?: Entry[]
}

export type Handler = {
  testFile?: (relative: string, entry?: Entry) => boolean,
  testDir?: (relative: string, entry?: Entry) => boolean
};

export async function bulkFind(handlers: Handler[], base?: string) {
  const res = await Promise.all(handlers.map(x => scanDir(x, base)));
  const names = new Set<string>();
  const out = [];
  for (const ls of res) {
    for (const e of ls) {
      if (!names.has(e.file)) {
        names.add(e.file);
        out.push(e);
      }
    }
  }
  return out;
}

export function scanDir(handler: Handler, base?: string, relBase?: string) {
  return new Promise<Entry[]>(async (resolve, reject) => {

    try {
      const out: Entry[] = [];

      base = base || process.cwd();
      relBase = relBase || base;

      for (const file of (await fsReaddir(relBase))) {
        if (file.startsWith('.')) {
          continue;
        }

        const full = `${relBase}${path.sep}${file}`;
        const stats = await fsStat(full);
        const entry: Entry = { stats, file: full };

        if (stats.isDirectory()) {
          if (!handler.testDir || handler.testDir(entry.file.replace(base + path.sep, ''), entry)) {
            entry.children = await scanDir(handler, base, full);
            out.push(entry);
            if (entry.children.length) {
              out.push(...entry.children);
            }
          }
        } else if (!handler.testFile || handler.testFile(entry.file.replace(base + path.sep, ''), entry)) {
          out.push(entry);
        }
      }
      resolve(out);
    } catch (e) {
      reject(e);
    }
  });
}

export function bulkFindSync(handlers: Handler[], base?: string) {
  const names = new Set<string>();
  const out = [];
  for (const h of handlers) {
    for (const e of scanDirSync(h, base)) {
      if (!names.has(e.file)) {
        names.add(e.file);
        out.push(e);
      }
    }
  }
  return out;
}

export function scanDirSync(handler: Handler, base?: string, relBase?: string) {
  const out: Entry[] = [];

  base = base || process.cwd();
  relBase = relBase || base;

  for (const file of fs.readdirSync(relBase)) {
    if (file.startsWith('.')) {
      continue;
    }

    const full = `${relBase}${path.sep}${file}`;
    const stats = fs.lstatSync(full);
    const entry: Entry = { stats, file: full };

    if (stats.isDirectory()) {
      if (!handler.testDir || handler.testDir(entry.file.replace(base + path.sep, ''), entry)) {
        entry.children = scanDirSync(handler, base, full);
        out.push(entry);
        if (entry.children.length) {
          out.push(...entry.children);
        }
      }
    } else if (!handler.testFile || handler.testFile(entry.file.replace(base + path.sep, ''))) {
      out.push(entry);
    }
  }
  return out;
}

export function bulkRequire<T = any>(handlers: Handler[], cwd?: string): T[] {
  return bulkFindSync(handlers, cwd)
    .filter(x => !x.stats.isDirectory()) // Skip folders
    .map(x => require(x.file))
    .filter(x => !!x); // Return non-empty values
}

export async function bulkRead(handlers: Handler[]) {
  const files = await bulkFind(handlers);
  const promises = files
    .filter(x => !x.stats.isDirectory())
    .map(x => fsReadFileAsync(x.file).then(d => ({ name: x.file, data: d.toString() })));
  return await Promise.all(promises);
}

export function bulkReadSync(handlers: Handler[]) {
  return bulkFindSync(handlers)
    .filter(x => !x.stats.isDirectory())
    .map(x => ({ name: x.file, data: fs.readFileSync(x.file).toString() }));
}

export async function rimraf(pth: string) {
  const files = await scanDir({}, pth);
  for (const filter of [
    (x: Entry) => !x.stats.isDirectory(),
    (x: Entry) => x.stats.isDirectory()
  ]) {
    await Promise.all(
      files
        .filter(filter)
        .map(x => fsUnlink(x.file)
          .catch(e => { console.error(`Unable to delete ${e.file}`) }))
    );
  }
}
