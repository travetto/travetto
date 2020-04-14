import { Suite, Test } from '@travetto/test';
import { SourceManager } from '..';
import { FsUtil } from '@travetto/boot';

const ROOT = FsUtil.resolveUnix(__dirname, '../external-test/type-transform');

@Suite()
export class TypeSuite {

  @Test()
  testStuff() {
    const src = new SourceManager(ROOT, [ROOT]);
    src.init();
    const file = FsUtil.resolveUnix(ROOT, 'src/sample.ts');
    const output = src.getTranspiled(file, true);
    console.log(output);
  }
}