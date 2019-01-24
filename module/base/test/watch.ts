import { Watcher } from '../src/watch';
import { Env } from '../src/env';
import { Test, Suite } from '@travetto/test';
import { FsUtil } from '../src/fs/fs-util';

@Suite()
export class WatchTest {

  @Test()
  async runWatcher() {
    const w = new Watcher({ cwd: FsUtil.resolveURI(Env.cwd, 'src') });
    w
      .on('all', ({ event, entry }) => {
        console.log(event, entry);
      });

    w.add([{ testFile: x => /.*/.test(x) }, __filename]);
    w.watch({
      uri: FsUtil.toURI(__dirname),
      module: __dirname.replace(/[\\]/g, '/'),
      stats: FsUtil.statSync(__dirname)
    });
  }
}