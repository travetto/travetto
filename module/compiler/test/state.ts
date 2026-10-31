import assert from 'node:assert';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { promisify } from 'node:util';

import { ManifestIndex, type ManifestRoot, path } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

import { AsyncQueue } from '../src/queue.ts';
import { CompilerState } from '../src/state.ts';
import { CompilerReset } from '../src/types.ts';
import { CompilerUtil } from '../src/util.ts';
import { CompilerWatcher } from '../src/watch.ts';

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
  verifyEmittedPathsAndOutputs() {
    assert.deepStrictEqual(CompilerUtil.getEmittedOutputs('/app/dist/index.js'), [
      '/app/dist/index.js',
      '/app/dist/index.js.map',
      '/app/dist/index.d.ts',
      '/app/dist/index.d.ts.map'
    ]);

    assert.strictEqual(CompilerUtil.isExternalTypings('src/main.ts'), true);
    assert.strictEqual(CompilerUtil.isExternalTypings('test/main.ts'), false);

    const jsResolution = CompilerUtil.resolveEmittedFilePath('/app/dist/src/main.js', 'main.js');
    assert.strictEqual(jsResolution.outputLocation, '/app/dist/src/main.js');
    assert.strictEqual(jsResolution.typingsLocation, undefined);

    const dtsResolution = CompilerUtil.resolveEmittedFilePath('/app/dist/src/main.js', 'main.d.ts', {
      moduleFile: 'src/main.ts',
      outputPath: '/app/dist',
      typingsPath: '/app/dist/typings'
    });
    assert.strictEqual(dtsResolution.outputLocation, '/app/dist/src/main.d.ts');
    assert.strictEqual(dtsResolution.typingsLocation, '/app/dist/typings/src/main.d.ts');
  }

  @Test()
  async verifyConfigurationFileChangesTriggerSoftReset() {
    const baseManifest = this.#createManifest();
    const state = await CompilerState.get(new ManifestIndex(baseManifest));
    const controller = new AbortController();
    const watcher = new CompilerWatcher(state, controller.signal);

    await assert.rejects(
      async () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/package.json') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    await assert.rejects(
      async () => watcher.prepareBatch([{ action: 'create', file: path.resolve('/test/app/module/sub/package.json') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    await assert.rejects(
      async () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/tsconfig.json') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    await assert.rejects(
      async () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/yarn.lock') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    await assert.rejects(
      async () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/pnpm-lock.yaml') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    await assert.rejects(
      async () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/pnpm-workspace.yaml') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    await assert.rejects(
      async () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/package-lock.json') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    // Should NOT reset for changes in separate work folders (.<name>/)
    const ignoredEvents = await watcher.prepareBatch([
      { action: 'update', file: path.resolve('/test/app/.worktrees/branch-a/package.json') },
      { action: 'update', file: path.resolve('/test/app/.worktree/package.json') },
      { action: 'update', file: path.resolve('/test/app/.gemini/scratch/tsconfig.json') },
      { action: 'update', file: path.resolve('/test/app/module/sub/.cache/package.json') }
    ]);
    assert.deepStrictEqual(ignoredEvents, []);
  }

  @Test()
  async verifyJsxRuntimeRewrite() {
    const baseManifest = this.#createManifest();
    const state = await CompilerState.get(new ManifestIndex(baseManifest));
    const targetPath = path.resolve('.trv/test-jsx-runtime.js');
    try {
      state.writeFile(targetPath, 'import { jsx } from "@travetto/doc/support/jsx-runtime";');
      const content = fs.readFileSync(targetPath, 'utf8');
      assert.strictEqual(content, 'import { jsx } from "@travetto/doc/support/jsx-runtime.js";');
    } finally {
      fs.rmSync(targetPath, { force: true });
    }
  }

  @Test()
  async verifyGitHeadChangeTriggersSoftReset() {
    const executeFile = promisify(execFile);
    const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git-watch-test-'));
    try {
      await executeFile('git', ['init', '-b', 'main'], { cwd: tempDirectory });
      await executeFile('git', ['config', 'user.name', 'Test'], { cwd: tempDirectory });
      await executeFile('git', ['config', 'user.email', 'test@test.com'], { cwd: tempDirectory });
      await fs.promises.writeFile(path.join(tempDirectory, 'package.json'), JSON.stringify({ name: 'git-test' }), 'utf8');
      await fs.promises.mkdir(path.join(tempDirectory, '.trv/output'), { recursive: true });
      await fs.promises.writeFile(path.join(tempDirectory, 'README.md'), '# Initial', 'utf8');
      await executeFile('git', ['add', '.'], { cwd: tempDirectory });
      await executeFile('git', ['commit', '-m', 'Initial commit'], { cwd: tempDirectory });

      const manifest: ManifestRoot = {
        generated: Date.now(),
        workspace: { name: 'git-test', path: tempDirectory, mono: false, manager: 'npm' },
        build: { compilerUrl: 'http://localhost:20000', outputFolder: '.trv/output', toolFolder: '.trv/tool', typesFolder: '.trv/types' },
        main: { name: 'git-test', folder: '', version: '1.0.0' },
        modules: {
          'git-test': {
            main: true,
            name: 'git-test',
            version: '1.0.0',
            workspace: true,
            production: true,
            sourceFolder: '',
            outputFolder: 'node_modules/git-test',
            roles: ['std'],
            parents: [],
            files: {}
          }
        }
      };

      const state = await CompilerState.get(new ManifestIndex(manifest));
      const controller = new AbortController();
      const watcher = new CompilerWatcher(state, controller.signal);

      const iteratorPromise = (async () => {
        try {
          for await (const _ of watcher) {
            // Wait for events
          }
        } catch (error) {
          return error;
        }
      })();

      // Wait a moment for watcher to initialize
      await new Promise(resolve => setTimeout(resolve, 200));

      // Make a new commit to change HEAD
      await fs.promises.writeFile(path.join(tempDirectory, 'README.md'), '# Updated', 'utf8');
      await executeFile('git', ['commit', '-am', 'Second commit'], { cwd: tempDirectory });

      const result = await Promise.race([
        iteratorPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for git reset')), 5000))
      ]);

      controller.abort();

      assert.ok(result instanceof CompilerReset);
      assert.strictEqual(result.soft, true);
      assert.ok(result.message.includes('Git branch or commit change detected'));
    } finally {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
