import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { ScanFs, TimeUtil } from '@travetto/base';

import { Watcher } from '../src/watcher';

@Suite()
export class WatchTest {

  @Test()
  async runWatcher() {
    const found: [string, string][] = [];
    const w = new Watcher(__source.folder);
    w
      .on('all', ({ event, entry }) => {
        console.log('Received event', { type: event, file: entry.file });
        found.push([event, entry.file]);
      });

    await TimeUtil.wait(100);

    w.close();

    const expected = (await ScanFs.scanDir({}, __source.folder)).filter(x => ScanFs.isNotDir(x));
    assert(found.filter(x => x[0] === 'added').length === expected.length);
    assert(found.filter(x => expected.find(y => y.file === x[1])).length === expected.length);
  }
}