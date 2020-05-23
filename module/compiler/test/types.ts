import { Suite, Test } from '@travetto/test';
import { Transpiler } from '..';
import { FsUtil, AppCache } from '@travetto/boot';

const ROOT = FsUtil.resolveUnix(__dirname, '../alt/type-transform');

@Suite()
export class TypeSuite {

  @Test()
  testStuff() {
    const src = new Transpiler(AppCache, [ROOT]);
    src.init();
    const file = FsUtil.resolveUnix(ROOT, 'src/sample.ts');
    const output = src.transpile(file, true);
    console.log(output);
  }
}