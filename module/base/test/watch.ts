import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Watcher, Env } from '../src';
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