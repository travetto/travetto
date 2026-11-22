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

  #createWatcher(state: CompilerState, signal: AbortSignal): CompilerWatcher {
    return new CompilerWatcher(
      {
        root: state.manifest.workspace.path,
        outputFolder: state.manifest.build.outputFolder,
        typesFolder: state.manifest.build.typesFolder,
        isCompilerFile: file => state.isCompilerFile(file),
        getBySource: file => state.getBySource(file),
        registerArbitraryFile: file => state.registerArbitraryFile(file),
        checkIfSourceChanged: file => state.checkIfSourceChanged(file)
      },
      signal
    );
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
  async verifyAtomicSaveCollapsing() {
    const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'atomic-save-test-'));
    try {
      const srcDir = path.join(tempDirectory, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });
      const alphaFile = path.join(srcDir, 'alpha.ts');
      await fs.promises.writeFile(alphaFile, 'export const a = 1;', 'utf8');

      const manifest: ManifestRoot = {
        generated: Date.now(),
        workspace: { name: 'test-app', path: path.toPosix(tempDirectory), mono: false, manager: 'npm' },
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

      const state = await CompilerState.get(new ManifestIndex(manifest));
      const controller = new AbortController();
      const watcher = this.#createWatcher(state, controller.signal);

      const batch = watcher.prepareBatch([
        { action: 'delete', file: path.toPosix(alphaFile) },
        { action: 'create', file: path.toPosix(alphaFile) }
      ]);

      assert.strictEqual(batch.length, 1);
      assert.strictEqual(batch[0].action, 'update');
      assert.strictEqual(batch[0].entry.sourceFile, path.toPosix(alphaFile));
    } finally {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  @Test()
  async verifyInvalidModuleFilesIgnored() {
    const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'invalid-module-file-test-'));
    try {
      const unknownFile = path.join(tempDirectory, 'scripts', 'helper.ts');
      const fixtureFile = path.join(tempDirectory, 'test', 'fixtures', 'sample.ts');
      await fs.promises.mkdir(path.dirname(unknownFile), { recursive: true });
      await fs.promises.mkdir(path.dirname(fixtureFile), { recursive: true });
      await fs.promises.writeFile(unknownFile, 'export const x = 1;', 'utf8');
      await fs.promises.writeFile(fixtureFile, 'export const y = 2;', 'utf8');

      const manifest: ManifestRoot = {
        generated: Date.now(),
        workspace: { name: 'test-app', path: path.toPosix(tempDirectory), mono: false, manager: 'npm' },
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

      const state = await CompilerState.get(new ManifestIndex(manifest));
      const controller = new AbortController();
      const watcher = this.#createWatcher(state, controller.signal);

      const batch = watcher.prepareBatch([
        { action: 'create', file: path.toPosix(unknownFile) },
        { action: 'create', file: path.toPosix(fixtureFile) }
      ]);

      assert.deepStrictEqual(batch, []);
    } finally {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  @Test()
  async verifyWatchManifestSync() {
    const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'manifest-sync-test-'));
    try {
      const srcDir = path.join(tempDirectory, 'src');
      const outputDir = path.join(tempDirectory, '.trv/output/node_modules/test-app');
      await fs.promises.mkdir(srcDir, { recursive: true });
      await fs.promises.mkdir(outputDir, { recursive: true });
      await fs.promises.writeFile(path.join(tempDirectory, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.0' }), 'utf8');
      const betaFile = path.join(srcDir, 'beta.ts');
      await fs.promises.writeFile(betaFile, 'export const b = 2;', 'utf8');

      const manifest: ManifestRoot = {
        generated: Date.now(),
        workspace: { name: 'test-app', path: path.toPosix(tempDirectory), mono: false, manager: 'npm' },
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

      await fs.promises.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
      const state = await CompilerState.get(new ManifestIndex(manifest));
      const controller = new AbortController();
      const watcher = this.#createWatcher(state, controller.signal);

      const batch = watcher.prepareBatch([{ action: 'create', file: path.toPosix(betaFile) }]);
      state.updateManifestInMemory(batch);
      assert.strictEqual(batch.length, 1);
      assert.ok(state.manifestIndex.getEntry(path.toPosix(betaFile)));

      await state.writeBatchManifests(batch);
      const savedManifest: ManifestRoot = JSON.parse(await fs.promises.readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
      assert.ok(savedManifest.modules['test-app'].files.src?.some(([file]) => file === 'src/beta.ts'));
    } finally {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  @Test()
  async verifyUntrackedUpdateRegistersExistingFile() {
    const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'untracked-update-test-'));
    try {
      const srcDir = path.join(tempDirectory, 'src');
      const outputDir = path.join(tempDirectory, '.trv/output/node_modules/test-app');
      await fs.promises.mkdir(srcDir, { recursive: true });
      await fs.promises.mkdir(outputDir, { recursive: true });
      await fs.promises.writeFile(path.join(tempDirectory, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.0' }), 'utf8');
      const betaFile = path.join(srcDir, 'beta.ts');
      const missingFile = path.join(srcDir, 'missing.ts');
      await fs.promises.writeFile(betaFile, 'export const b = 2;', 'utf8');

      const manifest: ManifestRoot = {
        generated: Date.now(),
        workspace: { name: 'test-app', path: path.toPosix(tempDirectory), mono: false, manager: 'npm' },
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

      await fs.promises.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
      const state = await CompilerState.get(new ManifestIndex(manifest));
      const controller = new AbortController();
      const watcher = this.#createWatcher(state, controller.signal);

      const batch = watcher.prepareBatch([
        { action: 'update', file: path.toPosix(betaFile) },
        { action: 'update', file: path.toPosix(missingFile) }
      ]);

      assert.strictEqual(batch.length, 1);
      assert.strictEqual(batch[0].action, 'create');
      assert.strictEqual(batch[0].entry.sourceFile, path.toPosix(betaFile));
      assert.strictEqual(state.getBySource(path.toPosix(missingFile)), undefined);
    } finally {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true });
    }
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
  verifyConfigurationFileChangesTriggerSoftReset() {
    const controller = new AbortController();
    const watcher = new CompilerWatcher({ root: '/test/app', outputFolder: '.trv/output', typesFolder: '.trv/types' }, controller.signal);

    assert.throws(
      () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/package.json') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    assert.throws(
      () => watcher.prepareBatch([{ action: 'create', file: path.resolve('/test/app/module/sub/package.json') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    assert.throws(
      () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/tsconfig.json') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    assert.throws(
      () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/yarn.lock') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    assert.throws(
      () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/pnpm-lock.yaml') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    assert.throws(
      () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/pnpm-workspace.yaml') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    assert.throws(
      () => watcher.prepareBatch([{ action: 'update', file: path.resolve('/test/app/package-lock.json') }]),
      (error: unknown) => error instanceof CompilerReset && error.soft === true
    );

    // Should NOT reset for changes in separate work folders (.<name>/)
    const ignoredEvents = watcher.prepareBatch([
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

      const controller = new AbortController();
      const watcher = new CompilerWatcher(
        { root: tempDirectory, outputFolder: '.trv/output', typesFolder: '.trv/types' },
        controller.signal
      );

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

  @Test()
  async verifyWorkspaceScopedLazyDependencyTracking() {
    const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dep-tracking-test-'));
    try {
      const applicationSourceDirectory = path.join(tempDirectory, 'src');
      const librarySourceDirectory = path.join(tempDirectory, 'node_modules', 'ext-lib', 'src');
      await fs.promises.mkdir(applicationSourceDirectory, { recursive: true });
      await fs.promises.mkdir(librarySourceDirectory, { recursive: true });

      const leafFile = path.toPosix(path.join(applicationSourceDirectory, 'leaf.ts'));
      const barrelFile = path.toPosix(path.join(applicationSourceDirectory, 'barrel.ts'));
      const consumerFile = path.toPosix(path.join(applicationSourceDirectory, 'consumer.ts'));
      const externalHelperFile = path.toPosix(path.join(librarySourceDirectory, 'helper.ts'));
      const externalInternalFile = path.toPosix(path.join(librarySourceDirectory, 'internal.ts'));

      await fs.promises.writeFile(
        path.join(tempDirectory, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            declaration: true,
            strict: true,
            skipLibCheck: true
          }
        }),
        'utf8'
      );
      await fs.promises.writeFile(leafFile, 'export const count: number = 1;', 'utf8');
      await fs.promises.writeFile(barrelFile, "export * from './leaf.ts';", 'utf8');
      await fs.promises.writeFile(
        consumerFile,
        "import { count } from './barrel.ts';\nimport { ext } from '../node_modules/ext-lib/src/helper.ts';\nexport const total: number = count + ext;",
        'utf8'
      );
      await fs.promises.writeFile(externalInternalFile, 'export const internal = 1;', 'utf8');
      await fs.promises.writeFile(
        externalHelperFile,
        "import { internal } from './internal.ts';\nexport const ext: number = internal;",
        'utf8'
      );

      const manifest: ManifestRoot = {
        generated: Date.now(),
        workspace: { name: 'test-app', path: path.toPosix(tempDirectory), mono: false, manager: 'npm' },
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
              src: [
                ['src/leaf.ts', 'ts', 1000],
                ['src/barrel.ts', 'ts', 1000],
                ['src/consumer.ts', 'ts', 1000]
              ]
            }
          },
          'ext-lib': {
            name: 'ext-lib',
            version: '1.0.0',
            workspace: false,
            production: true,
            sourceFolder: 'node_modules/ext-lib',
            outputFolder: 'node_modules/ext-lib',
            roles: ['std'],
            parents: [],
            files: {
              src: [
                ['src/helper.ts', 'ts', 1000],
                ['src/internal.ts', 'ts', 1000]
              ]
            }
          }
        }
      };

      // Non-watch builds skip dependency tracking completely
      const buildState = await CompilerState.get(new ManifestIndex(manifest), false);
      for await (const _ of buildState.compileAffectedFiles([leafFile, barrelFile, consumerFile])) {
        // Compile
      }
      assert.deepStrictEqual(buildState.getImporters(leafFile), []);
      assert.deepStrictEqual(buildState.getImporters(barrelFile), []);

      // Watch mode warms program without eagerly scanning all uncompiled files
      const watchState = await CompilerState.get(new ManifestIndex(manifest), true);
      await watchState.getProgram();
      assert.deepStrictEqual(watchState.getImporters(leafFile), []);
      assert.deepStrictEqual(watchState.getImporters(barrelFile), []);

      // Background / first watch event populates workspace dependencies and skips non-workspace modules
      const firstPromise = watchState.ensureDependencies();
      assert.strictEqual(watchState.ensureDependencies(), firstPromise);
      await firstPromise;
      assert.deepStrictEqual(watchState.getImporters(leafFile), [barrelFile]);
      assert.deepStrictEqual(watchState.getImporters(barrelFile), [consumerFile]);
      assert.deepStrictEqual(watchState.getImporters(externalInternalFile), []);
      assert.deepStrictEqual(watchState.getImporters(externalHelperFile), []);

      // Barrel re-export propagates breaking declaration changes to consumer
      await fs.promises.writeFile(leafFile, "export const count: string = 'invalid';", 'utf8');
      watchState.resetSource(leafFile);
      const compiled: { sourceFile: string; diagnostics: number }[] = [];
      for await (const result of watchState.compileAffectedFiles([leafFile])) {
        compiled.push({ sourceFile: result.sourceFile, diagnostics: result.diagnostics.length });
      }
      assert.deepStrictEqual(
        compiled.map(item => item.sourceFile),
        [leafFile, barrelFile, consumerFile]
      );
      assert.ok(compiled.find(item => item.sourceFile === consumerFile)!.diagnostics > 0);
    } finally {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  @Test()
  async verifyTypeScriptEmitExceptionRecovery() {
    const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'emit-recovery-test-'));
    try {
      const srcDir = path.join(tempDirectory, 'src');
      await fs.promises.mkdir(srcDir, { recursive: true });
      const alphaFile = path.toPosix(path.join(srcDir, 'alpha.ts'));
      await fs.promises.writeFile(alphaFile, 'export const a = 1;', 'utf8');
      await fs.promises.writeFile(path.join(tempDirectory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022' } }), 'utf8');

      // Block output directory creation with a regular file so program.emit throws
      const blockingOutput = path.join(tempDirectory, '.trv/output/node_modules/test-app');
      await fs.promises.mkdir(path.dirname(blockingOutput), { recursive: true });
      await fs.promises.writeFile(blockingOutput, 'blocker', 'utf8');

      const manifest: ManifestRoot = {
        generated: Date.now(),
        workspace: { name: 'test-app', path: path.toPosix(tempDirectory), mono: false, manager: 'npm' },
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
              src: [['src/alpha.ts', 'ts', 1000]]
            }
          }
        }
      };

      const state = await CompilerState.get(new ManifestIndex(manifest), true);
      const failedResults: { sourceFile: string; diagnostics: number }[] = [];
      for await (const result of state.compileAffectedFiles([alphaFile])) {
        failedResults.push({ sourceFile: result.sourceFile, diagnostics: result.diagnostics.length });
      }
      assert.strictEqual(failedResults.length, 1);
      assert.strictEqual(failedResults[0].diagnostics, 1);
      assert.strictEqual(state.hasErrors(alphaFile), true);

      // Remove blocker and verify next compile recovers cleanly
      await fs.promises.rm(blockingOutput, { force: true });
      const recoveredResults: { sourceFile: string; diagnostics: number }[] = [];
      for await (const result of state.compileAffectedFiles([alphaFile])) {
        recoveredResults.push({ sourceFile: result.sourceFile, diagnostics: result.diagnostics.length });
      }
      assert.strictEqual(recoveredResults.length, 1);
      assert.strictEqual(recoveredResults[0].diagnostics, 0);
      assert.strictEqual(state.hasErrors(alphaFile), false);
    } finally {
      await fs.promises.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  @Test()
  async verifyCoalescedCreateDeleteOnTrackedFile() {
    const baseManifest = this.#createManifest();
    const state = await CompilerState.get(new ManifestIndex(baseManifest));
    const alphaSource = path.resolve('/test/app/src/alpha.ts');
    const untrackedSource = path.resolve('/test/app/src/untracked.ts');

    const controller = new AbortController();
    const watcher = this.#createWatcher(state, controller.signal);

    const batch = watcher.prepareBatch([
      { action: 'create', file: alphaSource },
      { action: 'delete', file: alphaSource },
      { action: 'create', file: untrackedSource },
      { action: 'delete', file: untrackedSource }
    ]);

    assert.strictEqual(batch.length, 1);
    assert.strictEqual(batch[0].action, 'delete');
    assert.strictEqual(batch[0].entry.sourceFile, alphaSource);
  }
}
