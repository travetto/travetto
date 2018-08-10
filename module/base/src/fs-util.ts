import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';

import { ScanFs, ScanEntry } from './scan-fs';

const fsUnlink = util.promisify(fs.unlink);
const fsExists = util.promisify(fs.exists);
const fsMkdir = util.promisify(fs.mkdir);

export class FsUtil {

  static async mkdirp(pth: string) {
    if (!(await fsExists(pth))) {
      const parts = pth.split(path.sep);
      for (let i = 1; i <= parts.length; i++) {
        const subPath = parts.slice(0, i).join(path.sep);
        if (!(await fsExists(subPath))) {
          await fsMkdir(subPath);
        }
      }
    }
  }

  static async rimraf(pth: string) {
    const files = await ScanFs.scanDir({}, pth);
    for (const filter of [
      ScanFs.isNotDir,
      (x: ScanEntry) => x.stats.isDirectory()
    ]) {
      await Promise.all(
        files
          .filter(filter)
          .map(x => fsUnlink(x.file)
            .catch(e => { console.error(`Unable to delete ${e.file}`); }))
      );
    }
  }
}