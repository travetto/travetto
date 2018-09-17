import * as fs from 'fs';
import * as path from 'path';
import { Watcher } from '../src/watch';
import { Env } from '../src/env';
import { Test, Suite } from '@travetto/test';

@Suite()
export class WatchTest {

  @Test()
  async runWatcher() {
    const w = new Watcher({ cwd: path.join(Env.cwd, 'src') });
    w
      .on('all', ({ event, entry }) => {
        console.log(event, entry);
      });

    w.add([{ testFile: x => /.*/.test(x) }, __filename]);
    w.watch({
      file: __dirname,
      module: __dirname.replace(/[\\]/g, '/'),
      stats: fs.lstatSync(__dirname)
    });
  }
}