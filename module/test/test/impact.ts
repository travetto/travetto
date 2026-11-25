import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';

import { ManifestIndex, type ManifestRoot, path } from '@travetto/manifest';
import { Env, JSONUtil, RuntimeIndex } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import type { TestEvent } from '../src/model/event.ts';
import type { TestResult } from '../src/model/test.ts';
import { TestExecutor } from '../src/execute/executor.ts';
import { TestImpactGraph } from '../src/watch/impact.ts';

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
        parents: [],
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
        parents: ['test-app'],
        files: {
          test: [['test/ext.ts', 'ts', 1000, 'test']]
        }
      }
    }
  };
}

function makeAfterEvent(overrides: Partial<TestResult> & Pick<TestResult, 'import' | 'classId' | 'methodName' | 'status'>): TestEvent {
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
    const workspacePath = '/workspace';
    const propertiesSource = path.resolve(workspacePath, 'module/app/src/properties.ts');
    const yamlSource = path.resolve(workspacePath, 'module/app/src/yaml.ts');
    const index = new ManifestIndex(buildManifest(workspacePath));

    const delegatedEvents: TestEvent[] = [];
    const graph = new TestImpactGraph(
      {
        onEvent: (event: TestEvent) => delegatedEvents.push(event),
        onRemoveEvent: () => {},
        produceDiffSource: () => ({}),
        removeTest: () => {}
      } as never,
      index
    );

    // Cold module fallback before any test has executed
    const coldRuns = await graph.onCompilerChange({
      action: 'update',
      file: 'module/app/src/properties.ts',
      import: 'test-app/src/properties.ts',
      output: '',
      module: 'test-app',
      time: Date.now()
    });
    assert.deepStrictEqual(coldRuns, [{ import: 'test-app/test/parser.ts' }, { import: 'test-app/test/other.ts' }]);

    // Record per-test-key traces for two methods in the same suite + one cross-module test
    graph.onEvent(
      makeAfterEvent({
        import: 'test-app/test/parser.ts',
        classId: 'test-app:test/parser#ParserSuite',
        methodName: 'verifyProperties',
        status: 'passed',
        coveredFiles: [propertiesSource]
      })
    );
    graph.onEvent(
      makeAfterEvent({
        import: 'test-app/test/parser.ts',
        classId: 'test-app:test/parser#ParserSuite',
        methodName: 'verifyYaml',
        status: 'passed',
        coveredFiles: [yamlSource]
      })
    );
    graph.onEvent(
      makeAfterEvent({
        import: 'ext-mod/test/ext.ts',
        classId: 'ext-mod:test/ext#ExtSuite',
        methodName: 'verifyIntegration',
        status: 'failed',
        coveredFiles: [propertiesSource]
      })
    );

    // Ensure coveredFiles was stripped before delegating downstream
    assert(delegatedEvents.every(event => event.type === 'test' && event.phase === 'after' && !('coveredFiles' in event.test)));

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
  }

  @Test()
  async verifyTracePruningOnPassAndRetentionOnFailure() {
    const workspacePath = '/workspace';
    const propertiesSource = path.resolve(workspacePath, 'module/app/src/properties.ts');
    const yamlSource = path.resolve(workspacePath, 'module/app/src/yaml.ts');
    const graph = new TestImpactGraph(undefined, new ManifestIndex(buildManifest(workspacePath)));

    // Initial passing run covers both properties.ts and yaml.ts
    graph.onEvent(
      makeAfterEvent({
        import: 'test-app/test/parser.ts',
        classId: 'test-app:test/parser#ParserSuite',
        methodName: 'verifyCombined',
        status: 'passed',
        coveredFiles: [propertiesSource, yamlSource]
      })
    );

    // Failed run (early throw) only reaches properties.ts -> yaml.ts must be retained!
    graph.onEvent(
      makeAfterEvent({
        import: 'test-app/test/parser.ts',
        classId: 'test-app:test/parser#ParserSuite',
        methodName: 'verifyCombined',
        status: 'failed',
        coveredFiles: [propertiesSource]
      })
    );
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
    graph.onEvent(
      makeAfterEvent({
        import: 'test-app/test/parser.ts',
        classId: 'test-app:test/parser#ParserSuite',
        methodName: 'verifyCombined',
        status: 'passed',
        coveredFiles: [propertiesSource]
      })
    );
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
  }

  @Test()
  async verifyLiveInspectorTracerInExecutor() {
    const previousTrace = Env.TRV_TEST_TRACE.isSet ? Env.TRV_TEST_TRACE.isTrue : undefined;
    Env.TRV_TEST_TRACE.set(true);
    const captured: TestResult[] = [];
    try {
      const executor = new TestExecutor({
        onEvent: event => {
          if (event.type === 'test' && event.phase === 'after') {
            captured.push(event.test);
          }
        }
      });
      await executor.execute({
        import: '@travetto/test/test/impact.ts',
        classId: TracedHelperSuite.Ⲑid,
        methodNames: ['runSampleMethodOne', 'runSampleMethodTwo']
      });
    } finally {
      Env.TRV_TEST_TRACE.set(previousTrace);
    }

    assert(captured.length === 2);
    const jsonSource = RuntimeIndex.getFromImport('@travetto/runtime/src/json.ts')?.sourceFile;
    const tracerSource = RuntimeIndex.getFromImport('@travetto/test/src/watch/tracer.ts')?.sourceFile;
    assert(!!jsonSource);
    assert(captured[0].coveredFiles?.includes(jsonSource));
    assert(captured[1].coveredFiles?.includes(jsonSource));
    assert(!captured[0].coveredFiles?.includes(tracerSource!));
  }

  @Test()
  async verifyCachePersistenceAndStaleEntryPruning() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-cache-'));
    try {
      const cacheFile = path.join(tempDirectory, 'test-impact.json');
      const workspacePath = path.toPosix(tempDirectory);
      const propertiesSource = path.resolve(workspacePath, 'module/app/src/properties.ts');
      const yamlSource = path.resolve(workspacePath, 'module/app/src/yaml.ts');

      const writerGraph = new TestImpactGraph(undefined, new ManifestIndex(buildManifest(workspacePath)), cacheFile);
      writerGraph.onEvent(
        makeAfterEvent({
          import: 'test-app/test/parser.ts',
          classId: 'test-app:test/parser#ParserSuite',
          methodName: 'verifyProperties',
          status: 'passed',
          coveredFiles: [propertiesSource, yamlSource]
        })
      );
      writerGraph.onEvent(
        makeAfterEvent({
          import: 'ext-mod/test/ext.ts',
          classId: 'ext-mod:test/ext#ExtSuite',
          methodName: 'verifyIntegration',
          status: 'passed',
          coveredFiles: [propertiesSource]
        })
      );
      await writerGraph.flushCache();

      // Simulate restart where yaml.ts and ext-mod/test/ext.ts were deleted while offline
      const prunedManifest = buildManifest(workspacePath);
      prunedManifest.modules['test-app'].files.src = [['src/properties.ts', 'ts', 1000]];
      prunedManifest.modules['ext-mod'].files.test = [];

      const readerGraph = new TestImpactGraph(undefined, new ManifestIndex(prunedManifest), cacheFile);
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
}
