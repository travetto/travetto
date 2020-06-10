import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { FsUtil } from '@travetto/boot';
import { TranformerTestUtil } from './lib/util';

@Suite()
export class RecursiveTransformSuite {

  @Test()
  async transformTree() {
    const output = await TranformerTestUtil.compile(
      FsUtil.resolveUnix(__dirname, '../alt/recursive'),
      'tree.ts'
    );
    assert(output.includes('target: TreeNode'));
    assert(output.includes('TreeNode'));
  }


  @Test()
  async transformTree2() {
    const output = await TranformerTestUtil.compile(
      FsUtil.resolveUnix(__dirname, '../alt/recursive'),
      'tree2.ts'
    );
    assert(output.includes('target: TreeNode2'));
    assert(output.includes('TreeNode2'));
  }

  @Test()
  async transformTree3() {
    const output = await TranformerTestUtil.compile(
      FsUtil.resolveUnix(__dirname, '../alt/recursive'),
      'tree3.ts'
    );
    assert(output.includes('left:'));
    assert(output.includes('fieldTypes:'));
  }
}