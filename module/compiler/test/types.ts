import { Suite, Test } from '@travetto/test';
import { SourceManager } from '..';
import { Env } from '@travetto/base';

const ROOT = `${__dirname}/type-transform`;
const SRC = `${ROOT}/src`;

@Suite()
export class TypeSuite {


  @Test()
  testStuff() {
    const src = new SourceManager(Env.cwd, { cache: false });
    src.init();
    const output = src.getTranspiled(`${SRC}/sample.ts`, true);

  }
}