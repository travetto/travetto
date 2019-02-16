import * as fs from 'fs';

import { Env } from '../src/bootstrap/env';
import { FsUtil } from '../src/bootstrap/fs-util';

import { Watcher } from '../src/watch';
import { Test, Suite } from '@travetto/test';

@Suite()
export class WatchTest {

  @Test()
  async runWatcher() {
    const w = new Watcher({ cwd: FsUtil.joinUnix(Env.cwd, 'src') });
    w
      .on('all', ({ event, entry }) => {
        console.log(event, entry);
      });

    w.add([{ testFile: x => /.*/.test(x) }, FsUtil.toUnix(__filename)]);
    w.watch({
      file: FsUtil.toUnix(__dirname),
      module: FsUtil.toUnix(__dirname),
      stats: fs.lstatSync(__dirname)
    });
  }
}