import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';

import { ManifestIndex, type ManifestRoot, path } from '@travetto/manifest';
import { JSONUtil, RuntimeIndex } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import { TestExecutor } from '../src/execute/executor.ts';
import type { TestEvent } from '../src/model/event.ts';
import type { TestResult } from '../src/model/test.ts';
import { TestImpactGraph } from '../src/watch/impact.ts';
import { type PersistedImportTrace, TestExecutionTracer } from '../src/watch/tracer.ts';

function buildManifest(workspacePath: string): ManifestRoot {
  return {
    generated: Date.now(),
    workspace: { name: 'test-app', path: workspacePath, mono: true, manager: 'npm' },
    build: { compilerUrl: 'http://localhost:20000', outputFolder: '.trv/output', toolFolder: '.trv/tool', typesFolder: '.trv/types' },
    main: { name: 'test-app', folder: 'module/app', version: '1.0.0' },
    modules: {
      'test-app': {
        main: true,
        name: 'test-app',
        version: '1.0.0',
        workspace: true,
        production: true,
        sourceFolder: 'module/app',
        outputFolder: 'node_modules/test-app',
        roles: ['std', 'test'],
        parents: ['ext-mod'],
        files: {
          src: [
            ['src/properties.ts', 'ts', 1000],
            ['src/yaml.ts', 'ts', 1000]
          ],
          test: [
            ['test/parser.ts', 'ts', 1000, 'test'],
            ['test/other.ts', 'ts', 1000, 'test']
          ],
          doc: [['doc/sample.ts', 'ts', 1000, 'doc']]
        }
      },
      'ext-mod': {
        main: false,
        name: 'ext-mod',
        version: '1.0.0',
        workspace: true,
        production: true,
        sourceFolder: 'module/ext',
        outputFolder: 'node_modules/ext-mod',
        roles: ['std', 'test'],
        parents: [],
        files: {
          test: [['test/ext.ts', 'ts', 1000, 'test']]
        }
      }
    }
  };
}

function makeTestEvent(overrides: Partial<TestResult> & Pick<TestResult, 'import' | 'classId' | 'methodName' | 'status'>): TestEvent {
  return {
    type: 'test',
    phase: 'after',
    test: {
      assertions: [],
      duration: 1,
      selfDuration: 1,
      output: [],
      lineStart: 1,
      lineBodyStart: 1,
      lineEnd: 5,
      suiteLineStart: 1,
      ...overrides
    }
  };
}

function makeSuiteAfterEvent(importName: string, classId: string): TestEvent {
  return {
    type: 'suite',
    phase: 'after',
    suite: {
      import: importName,
      classId,
      lineStart: 1,
      lineEnd: 10,
      duration: 1,
      selfDuration: 1,
      status: 'passed',
      passed: 1,
      failed: 0,
      errored: 0,
      skipped: 0,
      unknown: 0,
      total: 1,
      tests: {}
    }
  };
}

@Suite()
class TracedHelperSuite {
  @Test()
  runSampleMethodOne() {
    assert(JSONUtil.toUTF8({ ok: true }) === '{"ok":true}');
  }

  @Test()
  runSampleMethodTwo() {
    assert(JSONUtil.toUTF8({ ok: false }) === '{"ok":false}');
  }
}

@Suite()
class TestImpactGraphSuite {
  @Test()
  async verifyPerTestKeyTraceAndColdModuleFallback() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-cold-'));
    try {
      const workspacePath = path.toPosix(tempDirectory);
      const propertiesSource = path.resolve(workspacePath, 'module/app/src/properties.ts');
      const yamlSource = path.resolve(workspacePath, 'module/app/src/yaml.ts');
      const index = new ManifestIndex(buildManifest(workspacePath));
      const tracer = new TestExecutionTracer(undefined, index);

      const graph = new TestImpactGraph(undefined, index);

      // Cold module fallback before any test has executed (depth 1 sorted by name, then depth 2)
      const coldRuns = await graph.onCompilerChange({
        action: 'update',
        file: 'module/app/src/properties.ts',
        import: 'test-app/src/properties.ts',
        output: '',
        module: 'test-app',
        time: Date.now()
      });
      assert.deepStrictEqual(coldRuns, [
        { import: 'test-app/test/other.ts' },
        { import: 'test-app/test/parser.ts' },
        { import: 'ext-mod/test/ext.ts' }
      ]);

      // If only test/other.ts is warmed (for yaml.ts), editing properties.ts must still fall back to untraced test/parser.ts and ext-mod/test/ext.ts
      await tracer.saveImportTrace('test-app/test/other.ts', [
        {
          classId: 'test-app:test/other#OtherSuite',
          methodName: 'verifyOther',
          status: 'passed',
          coveredFiles: [yamlSource]
        }
      ]);
      graph.onEvent(makeSuiteAfterEvent('test-app/test/other.ts', 'test-app:test/other#OtherSuite'));

      assert.deepStrictEqual(
        await graph.onCompilerChange({
          action: 'update',
          file: 'module/app/src/properties.ts',
          import: 'test-app/src/properties.ts',
          output: '',
          module: 'test-app',
          time: Date.now()
        }),
        [{ import: 'test-app/test/parser.ts' }, { import: 'ext-mod/test/ext.ts' }]
      );

      // Even if test/other.ts IS warmed for properties.ts, unwarmed test/parser.ts and ext-mod/test/ext.ts must still run
      await tracer.saveImportTrace('test-app/test/other.ts', [
        {
          classId: 'test-app:test/other#OtherSuite',
          methodName: 'verifyOther',
          status: 'passed',
          coveredFiles: [propertiesSource]
        }
      ]);
      graph.onEvent(makeSuiteAfterEvent('test-app/test/other.ts', 'test-app:test/other#OtherSuite'));

      assert.deepStrictEqual(
        await graph.onCompilerChange({
          action: 'update',
          file: 'module/app/src/properties.ts',
          import: 'test-app/src/properties.ts',
          output: '',
          module: 'test-app',
          time: Date.now()
        }),
        [
          { import: 'test-app/test/other.ts', classId: 'test-app:test/other#OtherSuite', methodNames: ['verifyOther'] },
          { import: 'test-app/test/parser.ts' },
          { import: 'ext-mod/test/ext.ts' }
        ]
      );

      // Restore test/other.ts to yamlSource before verifying parser.ts + ext.ts warmRuns
      await tracer.saveImportTrace('test-app/test/other.ts', [
        {
          classId: 'test-app:test/other#OtherSuite',
          methodName: 'verifyOther',
          status: 'passed',
          coveredFiles: [yamlSource]
        }
      ]);
      graph.onEvent(makeSuiteAfterEvent('test-app/test/other.ts', 'test-app:test/other#OtherSuite'));

      // Worker persists per-import trace files, and watcher loads them on suite 'after'
      await tracer.saveImportTrace('test-app/test/parser.ts', [
        {
          classId: 'test-app:test/parser#ParserSuite',
          methodName: 'verifyProperties',
          status: 'passed',
          coveredFiles: [propertiesSource]
        },
        {
          classId: 'test-app:test/parser#ParserSuite',
          methodName: 'verifyYaml',
          status: 'passed',
          coveredFiles: [yamlSource]
        }
      ]);
      await tracer.saveImportTrace('ext-mod/test/ext.ts', [
        {
          classId: 'ext-mod:test/ext#ExtSuite',
          methodName: 'verifyIntegration',
          status: 'failed',
          coveredFiles: [propertiesSource]
        }
      ]);

      graph.onEvent(makeSuiteAfterEvent('test-app/test/parser.ts', 'test-app:test/parser#ParserSuite'));
      graph.onEvent(
        makeTestEvent({
          import: 'ext-mod/test/ext.ts',
          classId: 'ext-mod:test/ext#ExtSuite',
          methodName: 'verifyIntegration',
          status: 'failed'
        })
      );
      graph.onEvent(makeSuiteAfterEvent('ext-mod/test/ext.ts', 'ext-mod:test/ext#ExtSuite'));

      // Updating properties.ts runs ONLY verifyProperties in ParserSuite (depth 1), followed by cross-module ExtSuite (depth 2)
      const warmRuns = await graph.onCompilerChange({
        action: 'update',
        file: 'module/app/src/properties.ts',
        import: 'test-app/src/properties.ts',
        output: '',
        module: 'test-app',
        time: Date.now()
      });
      assert.deepStrictEqual(warmRuns, [
        { import: 'test-app/test/parser.ts', classId: 'test-app:test/parser#ParserSuite', methodNames: ['verifyProperties'] },
        { import: 'ext-mod/test/ext.ts', classId: 'ext-mod:test/ext#ExtSuite', methodNames: ['verifyIntegration'] }
      ]);

      // Failure recency ordering for onRunTests
      assert.deepStrictEqual(graph.onRunTests(['test-app/test/parser.ts', 'ext-mod/test/ext.ts']), [
        { import: 'ext-mod/test/ext.ts' },
        { import: 'test-app/test/parser.ts' }
      ]);

      // Doc files are ignored
      assert.deepStrictEqual(
        await graph.onCompilerChange({
          action: 'update',
          file: 'module/app/doc/sample.ts',
          import: 'test-app/doc/sample.ts',
          output: '',
          module: 'test-app',
          time: Date.now()
        }),
        []
      );
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  @Test()
  async verifyTracePruningOnPassAndRetentionOnFailure() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-prune-'));
    try {
      const workspacePath = path.toPosix(tempDirectory);
      const propertiesSource = path.resolve(workspacePath, 'module/app/src/properties.ts');
      const yamlSource = path.resolve(workspacePath, 'module/app/src/yaml.ts');
      const index = new ManifestIndex(buildManifest(workspacePath));
      const tracer = new TestExecutionTracer(undefined, index);
      const graph = new TestImpactGraph(undefined, index);

      await tracer.saveImportTrace('test-app/test/other.ts', [
        { classId: 'test-app:test/other#OtherSuite', methodName: 'verifyOther', status: 'passed', coveredFiles: [] }
      ]);
      graph.onEvent(makeSuiteAfterEvent('test-app/test/other.ts', 'test-app:test/other#OtherSuite'));
      await tracer.saveImportTrace('ext-mod/test/ext.ts', [
        { classId: 'ext-mod:test/ext#ExtSuite', methodName: 'verifyIntegration', status: 'passed', coveredFiles: [] }
      ]);
      graph.onEvent(makeSuiteAfterEvent('ext-mod/test/ext.ts', 'ext-mod:test/ext#ExtSuite'));

      // Initial passing run covers both properties.ts and yaml.ts
      await tracer.saveImportTrace('test-app/test/parser.ts', [
        {
          classId: 'test-app:test/parser#ParserSuite',
          methodName: 'verifyCombined',
          status: 'passed',
          coveredFiles: [propertiesSource, yamlSource]
        }
      ]);
      graph.onEvent(makeSuiteAfterEvent('test-app/test/parser.ts', 'test-app:test/parser#ParserSuite'));

      // Failed run (early throw) only reaches properties.ts -> yaml.ts must be retained!
      await tracer.saveImportTrace('test-app/test/parser.ts', [
        {
          classId: 'test-app:test/parser#ParserSuite',
          methodName: 'verifyCombined',
          status: 'failed',
          coveredFiles: [propertiesSource]
        }
      ]);
      graph.onEvent(makeSuiteAfterEvent('test-app/test/parser.ts', 'test-app:test/parser#ParserSuite'));

      assert.deepStrictEqual(
        await graph.onCompilerChange({
          action: 'update',
          file: 'module/app/src/yaml.ts',
          import: 'test-app/src/yaml.ts',
          output: '',
          module: 'test-app',
          time: Date.now()
        }),
        [{ import: 'test-app/test/parser.ts', classId: 'test-app:test/parser#ParserSuite', methodNames: ['verifyCombined'] }]
      );

      // Subsequent passing run only covers properties.ts -> yaml.ts is now pruned!
      await tracer.saveImportTrace('test-app/test/parser.ts', [
        {
          classId: 'test-app:test/parser#ParserSuite',
          methodName: 'verifyCombined',
          status: 'passed',
          coveredFiles: [propertiesSource]
        }
      ]);
      graph.onEvent(makeSuiteAfterEvent('test-app/test/parser.ts', 'test-app:test/parser#ParserSuite'));

      assert.deepStrictEqual(
        await graph.onCompilerChange({
          action: 'update',
          file: 'module/app/src/yaml.ts',
          import: 'test-app/src/yaml.ts',
          output: '',
          module: 'test-app',
          time: Date.now()
        }),
        []
      );

      // Removing the method evicts it from properties.ts too
      graph.onRemoveEvent({
        type: 'removeTest',
        import: 'test-app/test/parser.ts',
        classId: 'test-app:test/parser#ParserSuite',
        methodName: 'verifyCombined'
      });
      assert.deepStrictEqual(
        await graph.onCompilerChange({
          action: 'update',
          file: 'module/app/src/properties.ts',
          import: 'test-app/src/properties.ts',
          output: '',
          module: 'test-app',
          time: Date.now()
        }),
        []
      );
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  @Test()
  async verifyLiveInspectorTracerInExecutorWritesPerImportFile() {
    const tracer = new TestExecutionTracer({ onEvent: () => {} });
    await tracer.onStart({});
    try {
      const executor = new TestExecutor(tracer);
      await executor.execute({
        import: '@travetto/test/test/impact.ts',
        classId: TracedHelperSuite.Ⲑid,
        methodNames: ['runSampleMethodOne', 'runSampleMethodTwo']
      });
    } finally {
      await tracer.flush();
    }

    const traceFile = TestExecutionTracer.getTraceFile(RuntimeIndex, '@travetto/test/test/impact.ts')!;
    const persisted = JSONUtil.fromUTF8<PersistedImportTrace>(await fs.readFile(traceFile, 'utf8'));
    const keyOne = `${TracedHelperSuite.Ⲑid}#runSampleMethodOne`;
    const keyTwo = `${TracedHelperSuite.Ⲑid}#runSampleMethodTwo`;
    assert(persisted.tests[keyOne]?.sources.some(source => source.endsWith('module/runtime/src/json.ts')));
    assert(persisted.tests[keyTwo]?.sources.some(source => source.endsWith('module/runtime/src/json.ts')));
    assert(!persisted.tests[keyOne]?.sources.some(source => source.endsWith('module/test/test/impact.ts')));
    assert(!persisted.tests[keyOne]?.sources.some(source => source.endsWith('module/test/src/watch/tracer.ts')));
  }

  @Test()
  async verifyCachePersistenceAndStaleEntryPruning() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-cache-'));
    try {
      const workspacePath = path.toPosix(tempDirectory);
      const propertiesSource = path.resolve(workspacePath, 'module/app/src/properties.ts');
      const yamlSource = path.resolve(workspacePath, 'module/app/src/yaml.ts');
      const tracer = new TestExecutionTracer(undefined, new ManifestIndex(buildManifest(workspacePath)));

      await tracer.saveImportTrace('test-app/test/other.ts', [
        { classId: 'test-app:test/other#OtherSuite', methodName: 'verifyOther', status: 'passed', coveredFiles: [] }
      ]);

      await tracer.saveImportTrace('test-app/test/parser.ts', [
        {
          classId: 'test-app:test/parser#ParserSuite',
          methodName: 'verifyProperties',
          status: 'passed',
          coveredFiles: [propertiesSource, yamlSource]
        }
      ]);
      await tracer.saveImportTrace('ext-mod/test/ext.ts', [
        {
          classId: 'ext-mod:test/ext#ExtSuite',
          methodName: 'verifyIntegration',
          status: 'passed',
          coveredFiles: [propertiesSource]
        }
      ]);

      // Simulate restart where yaml.ts and ext-mod/test/ext.ts were deleted while offline
      const prunedManifest = buildManifest(workspacePath);
      prunedManifest.modules['test-app'].files.src = [['src/properties.ts', 'ts', 1000]];
      prunedManifest.modules['ext-mod'].files.test = [];

      const readerGraph = new TestImpactGraph(undefined, new ManifestIndex(prunedManifest));
      await readerGraph.loadCache();

      // Warmed from disk: properties.ts hits ParserSuite#verifyProperties immediately (and deleted ExtSuite was pruned)
      assert.deepStrictEqual(
        await readerGraph.onCompilerChange({
          action: 'update',
          file: 'module/app/src/properties.ts',
          import: 'test-app/src/properties.ts',
          output: '',
          module: 'test-app',
          time: Date.now()
        }),
        [{ import: 'test-app/test/parser.ts', classId: 'test-app:test/parser#ParserSuite', methodNames: ['verifyProperties'] }]
      );

      // Deleted yaml.ts was pruned on load
      assert.deepStrictEqual(
        await readerGraph.onCompilerChange({
          action: 'update',
          file: 'module/app/src/yaml.ts',
          import: 'test-app/src/yaml.ts',
          output: '',
          module: 'test-app',
          time: Date.now()
        }),
        []
      );
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  @Test()
  async verifyDepthLimitCapsDownstreamAtTenSortedByDepthAndName() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-depth-'));
    try {
      const workspacePath = path.toPosix(tempDirectory);
      const manifest = buildManifest(workspacePath);
      manifest.modules['ext-mod'].parents = ['deep-mod'];
      manifest.modules['deep-mod'] = {
        main: false,
        name: 'deep-mod',
        version: '1.0.0',
        workspace: true,
        production: true,
        sourceFolder: 'module/deep',
        outputFolder: 'node_modules/deep-mod',
        roles: ['std', 'test'],
        parents: [],
        files: {
          test: [['test/deep.ts', 'ts', 1000, 'test']]
        }
      };
      manifest.modules['ext-mod'].files.test = Array.from({ length: 11 }, (_, i) => [
        `test/ext-${String(i).padStart(2, '0')}.ts`,
        'ts',
        1000,
        'test'
      ]);

      const graph = new TestImpactGraph(undefined, new ManifestIndex(manifest));
      const runs = await graph.onCompilerChange({
        action: 'update',
        file: 'module/app/src/properties.ts',
        import: 'test-app/src/properties.ts',
        output: '',
        module: 'test-app',
        time: Date.now()
      });

      // All depth < 2 (2 tests in test-app) + next 10 unwarmed downstream (depth 2 sorted by name; depth 3 deep.ts and ext-10.ts capped)
      assert.strictEqual(runs.length, 12);
      assert.deepStrictEqual(
        runs.slice(0, 2).map(run => run.import),
        ['test-app/test/other.ts', 'test-app/test/parser.ts']
      );
      assert.deepStrictEqual(
        runs.slice(2).map(run => run.import),
        Array.from({ length: 10 }, (_, i) => `ext-mod/test/ext-${String(i).padStart(2, '0')}.ts`)
      );

      // If deep-mod/test/deep.ts IS warmed and covers properties.ts, it is NOT crowded out by the 10 unwarmed depth-2 tests
      const propertiesSource = path.resolve(workspacePath, 'module/app/src/properties.ts');
      const index = new ManifestIndex(manifest);
      const tracer = new TestExecutionTracer(undefined, index);
      await tracer.saveImportTrace('deep-mod/test/deep.ts', [
        {
          classId: 'deep-mod:test/deep#DeepSuite',
          methodName: 'verifyDeep',
          status: 'passed',
          coveredFiles: [propertiesSource]
        }
      ]);
      const warmedGraph = new TestImpactGraph(undefined, index);
      await warmedGraph.loadCache();
      const runsWithDeepTraced = await warmedGraph.onCompilerChange({
        action: 'update',
        file: 'module/app/src/properties.ts',
        import: 'test-app/src/properties.ts',
        output: '',
        module: 'test-app',
        time: Date.now()
      });
      assert.strictEqual(runsWithDeepTraced.length, 13);
      assert(runsWithDeepTraced.some(run => run.import === 'deep-mod/test/deep.ts'));
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
