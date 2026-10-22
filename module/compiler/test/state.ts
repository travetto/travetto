import assert from 'node:assert';
import fs from 'node:fs';

import { ManifestIndex, type ManifestRoot, path } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

import { AsyncQueue } from '../src/queue.ts';
import { CompilerState } from '../src/state.ts';
import { CompilerUtil } from '../src/util.ts';

@Suite()
class CompilerStateTests {
  #createManifest(): ManifestRoot {
    return {
      generated: Date.now(),
      workspace: { name: 'test-app', path: '/test/app', mono: false, manager: 'npm' },
      build: { compilerUrl: 'http://localhost:20000', outputFolder: '.trv/output', toolFolder: '.trv/tool', typesFolder: '.trv/types' },
      main: { name: 'test-app', folder: '', version: '1.0.0' },
      modules: {
        'test-app': {
          main: true,
          name: 'test-app',
          version: '1.0.0',
          workspace: true,
          production: true,
          sourceFolder: '',
          outputFolder: 'node_modules/test-app',
          roles: ['std'],
          parents: [],
          files: {
            src: [['src/alpha.ts', 'ts', 1000]],
            $package: [['package.json', 'package-json', 1000]]
          }
        }
      }
    };
  }

  @Test()
  async verifyRemoveSource() {
    const baseManifest = this.#createManifest();
    const state = await CompilerState.get(new ManifestIndex(baseManifest));
    const alphaSource = path.resolve('/test/app/src/alpha.ts');

    assert(state.getBySource(alphaSource));
    assert.strictEqual(state.hasErrors(), false);
    assert.strictEqual(state.hasErrors(alphaSource), false);
    assert.strictEqual(state.failureCount, 0);

    const removed = await state.removeSource(alphaSource);
    assert(removed === true);
    assert(!state.getBySource(alphaSource));
    assert.strictEqual(state.hasErrors(), false);
    assert.strictEqual(state.hasErrors(alphaSource), false);
    assert.strictEqual(state.failureCount, 0);

    const secondRemoval = await state.removeSource(alphaSource);
    assert(secondRemoval === false);

    const nonExistentRemoved = await state.removeSource(path.resolve('/test/app/src/beta.ts'));
    assert(nonExistentRemoved === false);
  }

  @Test()
  async verifyFailedFilesAndHashReset() {
    const baseManifest = this.#createManifest();
    const state = await CompilerState.get(new ManifestIndex(baseManifest));
    const alphaSource = path.resolve('/test/app/src/alpha.ts');

    assert.deepStrictEqual(state.getFailedFiles(), []);

    state.resetSource(alphaSource);
    assert.deepStrictEqual(state.getFailedFiles(), []);
  }

  @Test()
  async verifyRealpath() {
    const baseManifest = this.#createManifest();
    const state = await CompilerState.get(new ManifestIndex(baseManifest));
    const cwd = path.resolve('.');
    assert.strictEqual(state.realpath(cwd), cwd);

    const symlinkPath = path.resolve('node_modules/@travetto/compiler');
    if (fs.existsSync(symlinkPath)) {
      const real = state.realpath(symlinkPath);
      assert.strictEqual(real, path.resolve('module/compiler'));
    }
  }

  @Test()
  async verifyAsyncQueueHas() {
    const queue = new AsyncQueue<{ file: string }>();
    assert.strictEqual(
      queue.has(item => item.file === 'test.ts'),
      false
    );
    queue.add({ file: 'test.ts' });
    assert.strictEqual(
      queue.has(item => item.file === 'test.ts'),
      true
    );
    assert.strictEqual(
      queue.has(item => item.file === 'other.ts'),
      false
    );
    const next = await queue.next();
    assert.strictEqual(next.value?.file, 'test.ts');
    assert.strictEqual(
      queue.has(item => item.file === 'test.ts'),
      false
    );
    queue.close();
  }

  @Test()
  async verifyProcessManagement() {
    assert.strictEqual(CompilerUtil.isProcessRunning(undefined), false);
    assert.strictEqual(CompilerUtil.isProcessRunning(0), false);
    assert.strictEqual(CompilerUtil.isProcessRunning(-1), false);

    assert.strictEqual(await CompilerUtil.killProcess(undefined), false);
    assert.strictEqual(await CompilerUtil.killProcess(0), false);
    assert.strictEqual(await CompilerUtil.killProcess(-1), false);
  }
}
