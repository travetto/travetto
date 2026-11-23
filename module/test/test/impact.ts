import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';

import { ManifestIndex, type ManifestRoot, path } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

import { TestImpactGraph } from '../src/execute/impact.ts';

@Suite()
class TestImpactGraphSuite {
  @Test()
  async verifyTextBasedTransitiveImpact() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-graph-'));
    try {
      const sourceDirectory = path.join(tempDirectory, 'src');
      const testDirectory = path.join(tempDirectory, 'test');
      const fixtureDirectory = path.join(testDirectory, 'fixtures');
      await fs.mkdir(sourceDirectory, { recursive: true });
      await fs.mkdir(fixtureDirectory, { recursive: true });

      const leafFile = path.toPosix(path.join(sourceDirectory, 'leaf.ts'));
      const middleFile = path.toPosix(path.join(sourceDirectory, 'middle.ts'));
      const unusedFile = path.toPosix(path.join(sourceDirectory, 'unused.ts'));
      const directTestFile = path.toPosix(path.join(testDirectory, 'leaf.ts'));
      const transitiveTestFile = path.toPosix(path.join(testDirectory, 'middle.ts'));
      const fixtureFile = path.toPosix(path.join(fixtureDirectory, 'helper.ts'));

      await fs.writeFile(leafFile, "import { helper } from './middle.ts';\nexport const leafValue = helper();", 'utf8');
      await fs.writeFile(middleFile, "export * from './leaf.ts';\nexport const helper = (): number => 1;", 'utf8');
      await fs.writeFile(unusedFile, 'export const untouched = 42;', 'utf8');
      await fs.writeFile(directTestFile, "import { leafValue } from '../src/leaf.ts';\nexport const testOne = leafValue;", 'utf8');
      await fs.writeFile(
        transitiveTestFile,
        "export async function run() { const mod = await import('../src/middle.ts'); return mod.helper(); }",
        'utf8'
      );
      await fs.writeFile(fixtureFile, "import { leafValue } from '../../src/leaf.ts';\nexport const fixtureValue = leafValue;", 'utf8');

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
            roles: ['std', 'test'],
            parents: [],
            files: {
              src: [
                ['src/leaf.ts', 'ts', 1000],
                ['src/middle.ts', 'ts', 1000],
                ['src/unused.ts', 'ts', 1000]
              ],
              test: [
                ['test/leaf.ts', 'ts', 1000, 'test'],
                ['test/middle.ts', 'ts', 1000, 'test']
              ],
              'test/fixtures': [['test/fixtures/helper.ts', 'fixture', 1000]]
            }
          }
        }
      };

      const graph = new TestImpactGraph(new ManifestIndex(manifest));
      await graph.init();

      assert.deepStrictEqual(
        graph.getImpactedTests(leafFile).map(entry => entry.sourceFile).sort(),
        [directTestFile, transitiveTestFile].sort()
      );
      assert.deepStrictEqual(
        graph.getImpactedTests(leafFile, 1).map(entry => entry.sourceFile),
        [directTestFile]
      );
      assert.deepStrictEqual(graph.getImpactedTests(unusedFile), []);
      assert.deepStrictEqual(
        graph.getImpactedTests(directTestFile).map(entry => entry.sourceFile),
        [directTestFile]
      );

      // Update file text to drop import and verify realtime graph update
      await fs.writeFile(directTestFile, 'export const testOne = 123;', 'utf8');
      await graph.updateFile(directTestFile);
      assert.deepStrictEqual(
        graph.getImpactedTests(leafFile).map(entry => entry.sourceFile),
        [transitiveTestFile]
      );
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
