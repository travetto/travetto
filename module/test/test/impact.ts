import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';

import { ManifestIndex, type ManifestRoot, path } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

import type { TestEvent } from '../src/model/event.ts';
import type { TestResult } from '../src/model/test.ts';
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
        parents: ['ext-mod'],
        files: {
          $index: [['__index__.ts', 'ts', 1000]],
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
        parents: ['deep-mod'],
        files: {
          src: [['src/helper.ts', 'ts', 1000]],
          test: [['test/ext.ts', 'ts', 1000, 'test']]
        }
      },
      'deep-mod': {
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

async function writeCompiled(index: ManifestIndex, importName: string, content: string): Promise<void> {
  const outputFile = index.getFromImport(importName)!.outputFile;
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, content, 'utf8');
}

@Suite()
class TestImpactGraphSuite {
  @Test()
  async verifyStaticImportGraphTransitiveAndFailureOrdering() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-static-'));
    try {
      const workspacePath = path.toPosix(tempDirectory);
      const index = new ManifestIndex(buildManifest(workspacePath));

      await writeCompiled(index, 'test-app/__index__.ts', "export * from './src/properties.js';\n");
      await writeCompiled(index, 'test-app/src/properties.ts', 'export const prop = 1;\n');
      await writeCompiled(index, 'test-app/src/yaml.ts', 'export const yaml = 1;\n');
      await writeCompiled(index, 'test-app/test/parser.ts', "import { prop } from '../src/properties.js';\n");
      await writeCompiled(index, 'test-app/test/other.ts', "import { yaml } from '../src/yaml.js';\n");
      await writeCompiled(index, 'test-app/doc/sample.ts', "import { prop } from '../src/properties.js';\n");
      await writeCompiled(index, 'ext-mod/src/helper.ts', "import { prop } from 'test-app';\n");
      await writeCompiled(index, 'ext-mod/test/ext.ts', "import { helper } from '../src/helper.js';\n");
      await writeCompiled(index, 'deep-mod/test/deep.ts', "import { prop } from 'test-app/src/properties.js';\n");

      const graph = new TestImpactGraph(undefined, index);
      await graph.loadCache();

      // Updating properties.ts finds same-module parser.ts (depth 1), ext.ts via barrel+helper (depth 2), and deep.ts (depth 3)
      const runs = await graph.onCompilerChange({
        action: 'update',
        file: 'module/app/src/properties.ts',
        import: 'test-app/src/properties.ts',
        output: '',
        module: 'test-app',
        time: Date.now()
      });
      assert.deepStrictEqual(runs, [
        { import: 'test-app/test/parser.ts' },
        { import: 'ext-mod/test/ext.ts' },
        { import: 'deep-mod/test/deep.ts' }
      ]);

      // Failure recency ordering for onRunTests
      graph.onEvent(
        makeTestEvent({
          import: 'ext-mod/test/ext.ts',
          classId: 'ext-mod:test/ext#ExtSuite',
          methodName: 'verifyExt',
          status: 'failed'
        })
      );
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

      // Incremental update: other.ts starts importing properties.ts
      await writeCompiled(index, 'test-app/test/other.ts', "import { prop } from '../src/properties.js';\n");
      assert.deepStrictEqual(
        await graph.onCompilerChange({
          action: 'update',
          file: 'module/app/test/other.ts',
          import: 'test-app/test/other.ts',
          output: '',
          module: 'test-app',
          time: Date.now()
        }),
        [{ import: 'test-app/test/other.ts' }]
      );

      const updatedRuns = await graph.onCompilerChange({
        action: 'update',
        file: 'module/app/src/properties.ts',
        import: 'test-app/src/properties.ts',
        output: '',
        module: 'test-app',
        time: Date.now()
      });
      assert.deepStrictEqual(updatedRuns, [
        { import: 'test-app/test/other.ts' },
        { import: 'test-app/test/parser.ts' },
        { import: 'ext-mod/test/ext.ts' },
        { import: 'deep-mod/test/deep.ts' }
      ]);

      // Deleting helper.ts notifies ext.ts once and removes helper.ts edges
      const deleteRuns = await graph.onCompilerChange({
        action: 'delete',
        file: 'module/ext/src/helper.ts',
        import: 'ext-mod/src/helper.ts',
        output: '',
        module: 'ext-mod',
        time: Date.now()
      });
      assert.deepStrictEqual(deleteRuns, [{ import: 'ext-mod/test/ext.ts' }]);

      const postDeleteRuns = await graph.onCompilerChange({
        action: 'update',
        file: 'module/app/src/properties.ts',
        import: 'test-app/src/properties.ts',
        output: '',
        module: 'test-app',
        time: Date.now()
      });
      assert.deepStrictEqual(postDeleteRuns, [
        { import: 'test-app/test/other.ts' },
        { import: 'test-app/test/parser.ts' },
        { import: 'deep-mod/test/deep.ts' }
      ]);
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  @Test()
  async verifyDepthLimitCapsDownstreamAtFiftySortedByDepthAndName() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-depth-'));
    try {
      const workspacePath = path.toPosix(tempDirectory);
      const manifest = buildManifest(workspacePath);
      manifest.modules['ext-mod'].files.test = Array.from({ length: 51 }, (_, i) => [
        `test/ext-${String(i).padStart(2, '0')}.ts`,
        'ts',
        1000,
        'test'
      ]);

      const index = new ManifestIndex(manifest);
      await writeCompiled(index, 'test-app/src/properties.ts', 'export const prop = 1;\n');
      await writeCompiled(index, 'test-app/test/parser.ts', "import { prop } from '../src/properties.js';\n");
      await writeCompiled(index, 'test-app/test/other.ts', "import { prop } from '../src/properties.js';\n");
      await writeCompiled(index, 'deep-mod/test/deep.ts', "import { prop } from 'test-app/src/properties.js';\n");
      for (let i = 0; i < 51; i += 1) {
        await writeCompiled(index, `ext-mod/test/ext-${String(i).padStart(2, '0')}.ts`, "import { prop } from 'test-app/src/properties.js';\n");
      }

      const graph = new TestImpactGraph(undefined, index);
      await graph.loadCache();

      const runs = await graph.onCompilerChange({
        action: 'update',
        file: 'module/app/src/properties.ts',
        import: 'test-app/src/properties.ts',
        output: '',
        module: 'test-app',
        time: Date.now()
      });

      assert.strictEqual(runs.length, 52);
      assert.deepStrictEqual(
        runs.slice(0, 2).map(run => run.import),
        ['test-app/test/other.ts', 'test-app/test/parser.ts']
      );
      assert.deepStrictEqual(
        runs.slice(2).map(run => run.import),
        Array.from({ length: 50 }, (_, i) => `ext-mod/test/ext-${String(i).padStart(2, '0')}.ts`)
      );
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
