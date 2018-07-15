import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { ScanApp } from '../src/scan-app';

@Suite()
class ScanTests {
  @Test()
  testFind() {
    const files = ScanApp.findFiles('.ts');

    assert(files.find(x => x.file.endsWith('src/scan-app.ts')));
  }
}