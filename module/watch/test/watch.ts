import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { ScanFs, ScanHandler } from '@travetto/boot';

import { Watcher } from '../src/watcher';

@Suite()
export class WatchTest {

  @Test()
  async runWatcher() {
    const found: [string, string][] = [];
    const w = new Watcher(__dirname);
    w
      .on('all', ({ event, entry }) => {
        console.log('Recevied event', { type: event, file: entry.file });
        found.push([event, entry.file]);
      });

    await new Promise(res => setTimeout(res, 100));

    w.close();

    const expected = ScanFs.scanDirSync({}, __dirname).filter(x => !x.stats.isDirectory());
    assert(found.filter(x => x[0] === 'added').length === expected.length);
    assert(found.filter(x => expected.find(y => y.file === x[1])).length === expected.length);
  }
}