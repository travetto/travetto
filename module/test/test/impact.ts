import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';

import type { CompilerChangeEvent } from '@travetto/compiler';
import { ManifestIndex, type ManifestRoot, path } from '@travetto/manifest';
import { AsyncQueue } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import { CumulativeSummaryConsumer } from '../src/consumer/types/cumulative.ts';
import { TestDurationCache } from '../src/execute/duration.ts';
import type { TestRun } from '../src/model/test.ts';
import { TestImpactGraph } from '../src/watch/impact.ts';

function buildManifest(workspacePath: string): ManifestRoot {
  const mod = (
    name: string,
    sourceFolder: string,
    parents: string[],
    files: ManifestRoot['modules'][string]['files']
  ): ManifestRoot['modules'][string] => ({
    main: name === 'test-app',
    name,
    version: '1.0.0',
    workspace: true,
    production: true,
    sourceFolder,
    outputFolder: `node_modules/${name}`,
    roles: ['std', 'test'],
    parents,
    files
  });
  return {
    generated: Date.now(),
    workspace: { name: 'test-app', path: workspacePath, mono: true, manager: 'npm' },
    build: { compilerUrl: 'http://localhost:20000', outputFolder: '.trv/output', toolFolder: '.trv/tool', typesFolder: '.trv/types' },
    main: { name: 'test-app', folder: 'module/app', version: '1.0.0' },
    modules: {
      'test-app': mod('test-app', 'module/app', ['ext-mod'], {
        $index: [['__index__.ts', 'ts', 1000]],
        src: [
          ['src/properties.ts', 'ts', 1000],
          ['src/helper.ts', 'ts', 1000],
          ['src/yaml.ts', 'ts', 1000]
        ],
        support: [['support/test/base.ts', 'ts', 1000, 'test']],
        test: [
          ['test/parser.ts', 'ts', 1000, 'test'],
          ['test/other.ts', 'ts', 1000, 'test'],
          ['test/shared.ts', 'ts', 1000, 'test']
        ],
        doc: [['doc/sample.ts', 'ts', 1000, 'doc']]
      }),
      'ext-mod': mod('ext-mod', 'module/ext', ['deep-mod'], {
        test: [
          ['test/ext-fast.ts', 'ts', 1000, 'test'],
          ['test/ext-slow.ts', 'ts', 1000, 'test'],
          ['test/ext-unknown.ts', 'ts', 1000, 'test'],
          ['test/ext-failing.ts', 'ts', 1000, 'test']
        ]
      }),
      'deep-mod': mod('deep-mod', 'module/deep', [], {
        test: [
          ['test/deep-fast.ts', 'ts', 1000, 'test'],
          ['test/deep-slow.ts', 'ts', 1000, 'test']
        ]
      }),
      'zero-mod': mod('zero-mod', 'module/zero', ['ext-mod'], {
        src: [['src/service.ts', 'ts', 1000]]
      })
    }
  };
}

const SUITE_SOURCE = "import { Suite } from '@travetto/test';\n@Suite()\nclass ExampleSuite {}\n";

async function writeFilePair(index: ManifestIndex, importName: string, source: string, compiled: string): Promise<void> {
  const entry = index.getFromImport(importName)!;
  await fs.mkdir(path.dirname(entry.sourceFile), { recursive: true });
  await fs.writeFile(entry.sourceFile, source, 'utf8');
  await fs.mkdir(path.dirname(entry.outputFile), { recursive: true });
  await fs.writeFile(entry.outputFile, compiled, 'utf8');
}

function recordSuite(summary: CumulativeSummaryConsumer, importName: string, status: 'passed' | 'failed', duration: number): void {
  const classId = `${importName}#Suite`;
  summary.onEvent({
    type: 'suite',
    phase: 'before',
    suite: { import: importName, classId, class: class {}, tests: {}, phaseHandlers: [], lineStart: 1, lineEnd: 5, sourceHash: 42 }
  });
  summary.onEvent({
    type: 'test',
    phase: 'before',
    test: {
      import: importName,
      classId,
      class: class {},
      methodName: 'verify',
      lineStart: 1,
      lineBodyStart: 1,
      lineEnd: 5,
      sourceHash: 100
    }
  });
  summary.onEvent({
    type: 'test',
    phase: 'after',
    test: {
      import: importName,
      classId,
      methodName: 'verify',
      status,
      assertions: [],
      duration,
      selfDuration: duration,
      output: [],
      lineStart: 1,
      lineBodyStart: 1,
      lineEnd: 5,
      suiteLineStart: 1,
      sourceHash: 100
    }
  });
  summary.onEvent({
    type: 'suite',
    phase: 'after',
    suite: {
      import: importName,
      classId,
      lineStart: 1,
      lineEnd: 5,
      duration,
      selfDuration: duration,
      status,
      passed: +(status === 'passed'),
      failed: +(status === 'failed'),
      errored: 0,
      skipped: 0,
      unknown: 0,
      total: 1,
      tests: {},
      sourceHash: 42
    }
  });
}

const change = (index: ManifestIndex, action: 'update' | 'delete', importName: string): CompilerChangeEvent => {
  const entry = index.getFromImport(importName)!;
  const workspacePath = index.manifest.workspace.path;
  return {
    action,
    file: path.relative(workspacePath, entry.sourceFile),
    relativeFile: entry.relativeFile,
    import: importName,
    output: path.relative(workspacePath, entry.outputFile),
    module: entry.module,
    time: Date.now()
  };
};

@Suite()
class TestImpactGraphSuite {
  @Test()
  async verifyLazySameModuleNarrowingExclusionsAndDiffing() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-lazy-'));
    try {
      const index = new ManifestIndex(buildManifest(path.toPosix(tempDirectory)));
      const summary = new CumulativeSummaryConsumer({ onEvent: (): void => {} });
      const durations = new TestDurationCache(index);
      summary.addConsumer(durations);

      await writeFilePair(index, 'test-app/src/properties.ts', 'export const prop = 1;\n', 'export const prop = 1;\n');
      await writeFilePair(
        index,
        'test-app/src/helper.ts',
        'export const h = 1;\n',
        "import { prop } from './properties.js';\nexport const h = prop;\n"
      );
      await writeFilePair(index, 'test-app/src/yaml.ts', 'export const yaml = 1;\n', 'export const yaml = 1;\n');
      await writeFilePair(index, 'test-app/support/test/base.ts', SUITE_SOURCE, "import { prop } from '../../src/properties.js';\n");
      await writeFilePair(index, 'test-app/test/shared.ts', 'export const x = 1;\n', "import { prop } from '../src/properties.js';\n");
      await writeFilePair(index, 'test-app/test/parser.ts', SUITE_SOURCE, "import { h } from '../src/helper.js';\n");
      await writeFilePair(index, 'test-app/test/other.ts', SUITE_SOURCE, "import { yaml } from '../src/yaml.js';\n");
      await writeFilePair(index, 'test-app/doc/sample.ts', 'export const x = 1;\n', "import { prop } from '../src/properties.js';\n");
      for (const imp of [
        'ext-mod/test/ext-fast.ts',
        'ext-mod/test/ext-slow.ts',
        'ext-mod/test/ext-unknown.ts',
        'ext-mod/test/ext-failing.ts',
        'deep-mod/test/deep-fast.ts',
        'deep-mod/test/deep-slow.ts'
      ]) {
        await writeFilePair(index, imp, SUITE_SOURCE, '');
      }

      recordSuite(summary, 'ext-mod/test/ext-fast.ts', 'passed', 40);
      recordSuite(summary, 'ext-mod/test/ext-slow.ts', 'passed', 150);
      recordSuite(summary, 'ext-mod/test/ext-failing.ts', 'failed', 250);
      recordSuite(summary, 'deep-mod/test/deep-fast.ts', 'passed', 30);
      recordSuite(summary, 'deep-mod/test/deep-slow.ts', 'passed', 200);

      const graph = new TestImpactGraph(
        (importName, tier) => ({
          importName,
          tier,
          duration: durations.get(importName),
          failing: summary.isFailing(importName)
        }),
        index
      );

      assert.deepStrictEqual(await graph.onCompilerChange(change(index, 'update', 'test-app/src/properties.ts')), [
        { import: 'test-app/test/parser.ts' },
        { import: 'ext-mod/test/ext-failing.ts' },
        { import: 'ext-mod/test/ext-fast.ts' },
        { import: 'deep-mod/test/deep-fast.ts' }
      ]);
      assert.deepStrictEqual(await graph.onCompilerChange(change(index, 'update', 'test-app/doc/sample.ts')), []);

      await writeFilePair(index, 'test-app/test/other.ts', SUITE_SOURCE, "import './shared.js';\nimport '../src/properties.js';\n");
      recordSuite(summary, 'test-app/test/other.ts', 'passed', 20);
      assert.deepStrictEqual(await graph.onCompilerChange(change(index, 'update', 'test-app/test/other.ts')), []);
      assert.deepStrictEqual(await graph.onCompilerChange(change(index, 'update', 'test-app/test/shared.ts')), [
        { import: 'test-app/test/other.ts' }
      ]);

      await graph.onCompilerChange(change(index, 'delete', 'test-app/src/helper.ts'));
      assert.deepStrictEqual(await graph.onCompilerChange(change(index, 'update', 'test-app/src/properties.ts')), [
        { import: 'test-app/test/other.ts' },
        { import: 'test-app/test/parser.ts' },
        { import: 'ext-mod/test/ext-failing.ts' },
        { import: 'ext-mod/test/ext-fast.ts' },
        { import: 'deep-mod/test/deep-fast.ts' }
      ]);

      recordSuite(summary, 'test-app/test/other.ts', 'failed', 55);
      await graph.onCompilerChange(change(index, 'delete', 'test-app/test/other.ts'));
      assert.strictEqual(summary.isFailing('test-app/test/parser.ts'), false);
      assert.strictEqual(durations.get('test-app/test/parser.ts'), undefined);
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  @Test()
  async verifyDirectParentFallbackDownstreamCapAndPrependOrder() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-downstream-'));
    try {
      const manifest = buildManifest(path.toPosix(tempDirectory));
      const extraFast = Array.from(
        { length: 12 },
        (_, idx) => [`test/fast-${`${idx}`.padStart(2, '0')}.ts`, 'ts', 1000, 'test'] as [string, 'ts', number, 'test']
      );
      manifest.modules['ext-mod'].files.test = [
        ...extraFast,
        ['test/ext-slow.ts', 'ts', 1000, 'test'],
        ['test/ext-unknown.ts', 'ts', 1000, 'test']
      ];

      const index = new ManifestIndex(manifest);
      const summary = new CumulativeSummaryConsumer({ onEvent: (): void => {} });
      const durations = new TestDurationCache(index);
      summary.addConsumer(durations);

      await writeFilePair(index, 'test-app/src/properties.ts', 'export const prop = 1;\n', 'export const prop = 1;\n');
      await writeFilePair(index, 'test-app/support/test/base.ts', SUITE_SOURCE, "import '../../src/properties.js';\n");
      await writeFilePair(index, 'test-app/test/parser.ts', SUITE_SOURCE, "import '../src/properties.js';\n");
      await writeFilePair(index, 'zero-mod/src/service.ts', 'export const service = 1;\n', 'export const service = 1;\n');
      for (let idx = 0; idx < 12; idx += 1) {
        const importName = `ext-mod/test/fast-${`${idx}`.padStart(2, '0')}.ts`;
        await writeFilePair(index, importName, SUITE_SOURCE, '');
        recordSuite(summary, importName, 'passed', 10 + idx);
      }
      await writeFilePair(index, 'ext-mod/test/ext-slow.ts', SUITE_SOURCE, '');
      await writeFilePair(index, 'ext-mod/test/ext-unknown.ts', SUITE_SOURCE, '');
      await writeFilePair(index, 'deep-mod/test/deep-fast.ts', SUITE_SOURCE, '');
      await writeFilePair(index, 'deep-mod/test/deep-slow.ts', SUITE_SOURCE, '');
      recordSuite(summary, 'ext-mod/test/ext-slow.ts', 'passed', 150);
      recordSuite(summary, 'deep-mod/test/deep-fast.ts', 'passed', 25);
      recordSuite(summary, 'deep-mod/test/deep-slow.ts', 'passed', 300);

      const standardRuns = await new TestImpactGraph(
        (importName, tier) => ({
          importName,
          tier,
          duration: durations.get(importName),
          failing: summary.isFailing(importName)
        }),
        index
      ).onCompilerChange(change(index, 'update', 'test-app/src/properties.ts'));
      assert.strictEqual(standardRuns.length, 11);
      assert.strictEqual(standardRuns[0].import, 'test-app/test/parser.ts');
      assert.strictEqual(standardRuns[10].import, 'ext-mod/test/fast-09.ts');

      manifest.modules['ext-mod'].files.test = [
        ['test/fast-00.ts', 'ts', 1000, 'test'],
        ['test/ext-slow.ts', 'ts', 1000, 'test'],
        ['test/ext-unknown.ts', 'ts', 1000, 'test']
      ];
      const fallbackIndex = new ManifestIndex(manifest);
      const fallbackGraph = new TestImpactGraph(
        (importName, tier) => ({
          importName,
          tier,
          duration: durations.get(importName),
          failing: summary.isFailing(importName)
        }),
        fallbackIndex
      );
      const expectedFallback = [
        { import: 'ext-mod/test/fast-00.ts' },
        { import: 'ext-mod/test/ext-slow.ts' },
        { import: 'ext-mod/test/ext-unknown.ts' },
        { import: 'deep-mod/test/deep-fast.ts' }
      ];
      assert.deepStrictEqual(
        await fallbackGraph.onCompilerChange(change(fallbackIndex, 'update', 'test-app/support/test/base.ts')),
        expectedFallback
      );
      assert.deepStrictEqual(
        await fallbackGraph.onCompilerChange(change(fallbackIndex, 'update', 'zero-mod/src/service.ts')),
        expectedFallback
      );

      const queue = new AsyncQueue<TestRun>([{ import: 'initial.ts' }]);
      for (const run of [{ import: 'first.ts' }, { import: 'second.ts' }, { import: 'third.ts' }].toReversed()) {
        queue.add(run, true);
      }
      queue.close();
      const drained: string[] = [];
      for await (const run of queue) {
        drained.push(run.import);
      }
      assert.deepStrictEqual(drained, ['first.ts', 'second.ts', 'third.ts', 'initial.ts']);
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
