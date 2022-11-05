import * as assert from 'assert';

import * as fs from 'fs/promises';

import { Manifest } from '@travetto/boot';
import * as path from '@travetto/path';
import { BeforeAll, Suite, Test } from '@travetto/test';
import { ExecUtil } from '@travetto/base';

const E2E_ROOT = path.resolve('..', '..', '..', 'related', 'transformer');
const E2E_OUT = path.resolve(E2E_ROOT, '.trv_out');

@Suite()
export class RecursiveTransformSuite {

  #manifest: Manifest;

  @BeforeAll()
  async init() {
    // Build
    await ExecUtil.spawn('trv', [], { cwd: E2E_ROOT }).result;

    this.#manifest = JSON.parse(await fs.readFile(path.resolve(E2E_ROOT, '.trv_out', 'manifest.json'), 'utf8'));
  }

  async readFile(file: string): Promise<string> {
    const main = Object.values(this.#manifest.modules).find(x => x.main)!;
    return fs.readFile(path.resolve(E2E_OUT, main.output, file.replace(/[.]ts$/, '.js')), 'utf8');
  }

  @Test({ timeout: '10s' })
  async transformTree() {
    const output = await this.readFile('src/tree.ts');
    assert(output.includes('name: \'TreeNode\''));
    assert(output.includes('TreeNode'));
  }

  @Test({ timeout: '10s' })
  async transformTree2() {
    const output = await this.readFile('src/tree2.ts');
    assert(output.includes('name: \'TreeNode2\''));
    assert(output.includes('TreeNode2'));
  }

  @Test({ timeout: '10s' })
  async transformTree3() {
    const output = await this.readFile('src/tree3.ts');
    assert(output.includes('left:'));
    assert(output.includes('fieldTypes:'));
  }
}