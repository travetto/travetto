import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { ScanFs } from '@travetto/boot';
import { Util } from '@travetto/base';

import { Watcher } from '../src/watcher';

@Suite()
export class WatchTest {

  @Test()
  async runWatcher() {
    const found: [string, string][] = [];
    const w = new Watcher(__dirname);
    w
      .on('all', ({ event, entry }) => {
        console.log('Received event', { type: event, file: entry.file });
        found.push([event, entry.file]);
      });

    await Util.wait(100);

    w.close();

    const expected = (await ScanFs.scanDir({}, __dirname)).filter(x => ScanFs.isNotDir(x));
    assert(found.filter(x => x[0] === 'added').length === expected.length);
    assert(found.filter(x => expected.find(y => y.file === x[1])).length === expected.length);
  }
}