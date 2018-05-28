import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import { AppEnv } from './env';

const fsReadFileAsync = util.promisify(fs.readFile);
const fsStat = util.promisify(fs.lstat);
const fsReaddir = util.promisify(fs.readdir);
const fsUnlink = util.promisify(fs.unlink);

export interface Entry {
  file: string;
  module: string;
  stats: fs.Stats;
  children?: Entry[];
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

export function scanDir(handler: Handler, base?: string, entry?: Entry) {
  return new Promise<Entry[]>(async (resolve, reject) => {

    try {
      const out: Entry[] = [];

      base = base || AppEnv.cwd;
      entry = (entry || { file: base, children: [] }) as Entry;

      for (const file of (await fsReaddir(entry.file))) {
        if (file.startsWith('.')) {
          continue;
        }

        const full = path.join(entry.file, file);
        const stats = await fsStat(full);
        const subEntry: Entry = { stats, file: full, module: full.replace(`${AppEnv.cwd}${path.sep}`, '').replace(/[\\]+/g, '/') };

        if (stats.isDirectory()) {
          if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
            out.push(subEntry, ...await scanDir(handler, base, subEntry));
          }
        } else if (!handler.testFile || handler.testFile(subEntry.module, subEntry)) {
          entry.children!.push(subEntry);
          out.push(subEntry);
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

export function scanDirSync(handler: Handler, base?: string, entry?: Entry) {
  const out: Entry[] = [];

  base = base || AppEnv.cwd;
  entry = (entry || { file: base, children: [] }) as Entry;

  for (const file of fs.readdirSync(entry.file)) {
    if (file.startsWith('.')) {
      continue;
    }

    const full = path.join(entry.file, file);
    const stats = fs.lstatSync(full);
    const subEntry: Entry = { stats, file: full, module: full.replace(`${AppEnv.cwd}${path.sep}`, '').replace(/[\\]+/g, '/') };

    if (stats.isDirectory()) {
      if (!handler.testDir || handler.testDir(subEntry.module, subEntry)) {
        out.push(subEntry, ...scanDirSync(handler, base, subEntry));
      }
    } else if (!handler.testFile || handler.testFile(subEntry.module, subEntry)) {
      entry.children!.push(subEntry);
      out.push(subEntry);
    }
  }
  return out;
}

export function bulkRequire<T = any>(handlers: Handler[], cwd?: string): T[] {
  return bulkFindSync(handlers, cwd)
    .filter(x => !x.stats.isDirectory()) // Skip folders
    .map(x => require(x.file.replace(/[\\]+/g, '/')))
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
          .catch(e => { console.error(`Unable to delete ${e.file}`); }))
    );
  }
}
