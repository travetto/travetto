import * as fs from 'fs';
import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { Env } from '../src/bootstrap/env';
import { FsUtil } from '../src/bootstrap/fs-util';
import { Watcher } from '../src/watch';
import { ScanFs } from '../src/bootstrap/scan-fs';

@Suite()
export class WatchTest {

  @Test()
  async runWatcher() {
    const found: [string, string][] = [];
    const w = new Watcher({ cwd: FsUtil.joinUnix(Env.cwd, 'src') });
    w
      .on('all', ({ event, entry }) => {
        console.log(event, entry.file);
        found.push([event, entry.file]);
      });

    w.add([{ testFile: x => /.*/.test(x) }, FsUtil.toUnix(__filename)]);
    w.watch({
      file: FsUtil.toUnix(__dirname),
      module: FsUtil.toUnix(__dirname),
      stats: fs.lstatSync(__dirname)
    });

    await new Promise(res => setTimeout(res, 100));

    w.close();

    const expected = ScanFs.scanDirSync({} as any, __dirname);
    assert(found.filter(x => x[0] === 'added').length === expected.length);
    assert(found.filter(x => expected.find(y => y.file === x[1])).length === expected.length);
  }
}