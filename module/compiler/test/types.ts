import * as path from 'path';

import { Suite, Test } from '@travetto/test';
import { SourceManager } from '..';
import { AppCache } from '@travetto/boot';

const ROOT = path.resolve(__dirname, '../external-test/type-transform');
const SRC = `${ROOT}/src`;

@Suite()
export class TypeSuite {


  @Test()
  testStuff() {
    const src = new SourceManager(ROOT, [ROOT], { cache: false });
    src.init();
    const output = src.getTranspiled(`${SRC}/sample.ts`, true);
    AppCache.removeEntry(`${SRC}/sample.ts`);
    console.log(output);
  }
}