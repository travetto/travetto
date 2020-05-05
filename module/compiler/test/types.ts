import { Suite, Test } from '@travetto/test';
import { Transpiler } from '..';
import { FsUtil, AppCache } from '@travetto/boot';

const ROOT = FsUtil.resolveUnix(__dirname, '../external-test/type-transform');

@Suite()
export class TypeSuite {

  @Test()
  testStuff() {
    const src = new Transpiler(ROOT, AppCache, [ROOT]);
    src.init();
    const file = FsUtil.resolveUnix(ROOT, 'src/sample.ts');
    const output = src.getTranspiled(file, true);
    console.log(output);
  }
}