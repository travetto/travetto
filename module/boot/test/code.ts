import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { SourceIndex } from '../src/internal/source';

@Suite()
class ScanTests {
  @Test()
  testFind() {
    const files = SourceIndex.find({});
    assert(files.some(x => x.file.endsWith('test/source.ts')));
  }
}