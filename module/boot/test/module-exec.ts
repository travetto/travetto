import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import { ModuleExec } from '../src/internal/module-exec';


@Suite()
export class ModuleExecSuite {

  @Test()
  async forkMain() {
    const proc = ModuleExec.forkMain(await ResourceManager.findAbsolute('test.ts'));
    const result = await proc.result;
    assert(result.stdout === 'Hello World\n');
  }

  @Test()
  async worker() {
    const { message } = ModuleExec.workerMain(await ResourceManager.findAbsolute('worker.ts'));
    const result = await message;
    assert.deepStrictEqual(result, { a: 1, b: 2, c: new Set([1, 2, 3]) });
  }
}