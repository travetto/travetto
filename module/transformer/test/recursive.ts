import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { PathUtil } from '@travetto/boot';
import { TranformerTestUtil } from '../test-support/util';

@Suite()
export class RecursiveTransformSuite {

  @Test({ timeout: 10000 })
  async transformTree() {
    const output = await TranformerTestUtil.compile(
      PathUtil.resolveUnix(__dirname, '../e2e'),
      'tree.ts'
    );
    assert(output.includes('name: \'TreeNode\''));
    assert(output.includes('TreeNode'));
  }

  @Test({ timeout: 10000 })
  async transformTree2() {
    const output = await TranformerTestUtil.compile(
      PathUtil.resolveUnix(__dirname, '../e2e'),
      'tree2.ts'
    );
    assert(output.includes('name: \'TreeNode2\''));
    assert(output.includes('TreeNode2'));
  }

  @Test({ timeout: 10000 })
  async transformTree3() {
    const output = await TranformerTestUtil.compile(
      PathUtil.resolveUnix(__dirname, '../e2e'),
      'tree3.ts'
    );
    assert(output.includes('left:'));
    assert(output.includes('fieldTypes:'));
  }
}