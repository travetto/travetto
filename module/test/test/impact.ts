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

  @Test()
  async verifyBarrelSymbolFiltering() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-impact-barrel-'));
    try {
      const sourceDirectory = path.join(tempDirectory, 'src');
      const testDirectory = path.join(tempDirectory, 'test');
      await fs.mkdir(sourceDirectory, { recursive: true });
      await fs.mkdir(testDirectory, { recursive: true });

      const barrelFile = path.toPosix(path.join(tempDirectory, '__index__.ts'));
      const envFile = path.toPosix(path.join(sourceDirectory, 'env.ts'));
      const jsonFile = path.toPosix(path.join(sourceDirectory, 'json.ts'));
      const envTestFile = path.toPosix(path.join(testDirectory, 'env.ts'));
      const jsonTestFile = path.toPosix(path.join(testDirectory, 'json.ts'));

      await fs.writeFile(barrelFile, "export * from './src/env.ts';\nexport * from './src/json.ts';", 'utf8');
      await fs.writeFile(envFile, 'export class EnvProp {}', 'utf8');
      await fs.writeFile(jsonFile, 'export class JSONUtil {}', 'utf8');
      await fs.writeFile(envTestFile, "import { EnvProp } from 'test-app';\nexport const a = new EnvProp();", 'utf8');
      await fs.writeFile(jsonTestFile, "import { JSONUtil } from 'test-app';\nexport const b = new JSONUtil();", 'utf8');

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
              $index: [['__index__.ts', 'ts', 1000]],
              src: [
                ['src/env.ts', 'ts', 1000],
                ['src/json.ts', 'ts', 1000]
              ],
              test: [
                ['test/env.ts', 'ts', 1000, 'test'],
                ['test/json.ts', 'ts', 1000, 'test']
              ]
            }
          }
        }
      };

      const graph = new TestImpactGraph(new ManifestIndex(manifest));
      await graph.init();

      assert.deepStrictEqual(
        graph.getImpactedTests(envFile).map(entry => entry.sourceFile),
        [envTestFile]
      );
      assert.deepStrictEqual(
        graph.getImpactedTests(jsonFile).map(entry => entry.sourceFile),
        [jsonTestFile]
      );
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
