import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { TransformerTestUtil } from '../support/test.util';
import { SystemUtil } from '../src/util/system';

@Suite()
export class RecursiveTransformSuite {

  @Test({ timeout: '10s' })
  async transformTree() {
    const output = await TransformerTestUtil.compile(
      SystemUtil.resolveUnix(__source.folder, '../e2e'),
      'tree.ts'
    );
    assert(output.includes('name: \'TreeNode\''));
    assert(output.includes('TreeNode'));
  }

  @Test({ timeout: '10s' })
  async transformTree2() {
    const output = await TransformerTestUtil.compile(
      SystemUtil.resolveUnix(__source.folder, '../e2e'),
      'tree2.ts'
    );
    assert(output.includes('name: \'TreeNode2\''));
    assert(output.includes('TreeNode2'));
  }

  @Test({ timeout: '10s' })
  async transformTree3() {
    const output = await TransformerTestUtil.compile(
      SystemUtil.resolveUnix(__source.folder, '../e2e'),
      'tree3.ts'
    );
    assert(output.includes('left:'));
    assert(output.includes('fieldTypes:'));
  }
}