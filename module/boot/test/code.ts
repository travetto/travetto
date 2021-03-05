import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { SourceCodeIndex } from '../src/internal/code';

@Suite()
class ScanTests {
  @Test()
  testFind() {
    const files = SourceCodeIndex.find({});
    assert(files.some(x => x.file.endsWith('test/source.ts')));
  }
}