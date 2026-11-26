import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';

import { ManifestIndex, type ManifestRoot, path } from '@travetto/manifest';
import { Suite, Test } from '@travetto/test';

import { TestDurationCache } from '../src/execute/duration.ts';
import type { TestEvent } from '../src/model/event.ts';

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
          test: [
            ['test/fast.ts', 'ts', 1000, 'test'],
            ['test/medium.ts', 'ts', 1000, 'test'],
            ['test/slow.ts', 'ts', 1000, 'test'],
            ['test/unknown.ts', 'ts', 1000, 'test']
          ]
        }
      }
    }
  };
}

function makeSuiteAfterEvent(importName: string, duration: number, className = 'Suite'): TestEvent {
  return {
    type: 'suite',
    phase: 'after',
    suite: {
      import: importName,
      classId: `${importName}#${className}`,
      lineStart: 1,
      lineEnd: 5,
      duration,
      selfDuration: duration,
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
class TestDurationCacheSuite {
  @Test()
  async verifyPerSuitePersistenceTrendSmoothingAndSlowestFirstSorting() {
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'test-duration-cache-'));
    try {
      const workspacePath = path.toPosix(tempDirectory);
      const manifest = buildManifest(workspacePath);
      const index = new ManifestIndex(manifest);
      const cache = new TestDurationCache(index);

      // Multiple suites in fast.ts sum together; repeated runs smooth via EMA (0.7 * 1000 + 0.3 * 2000 = 1300)
      cache.onEvent(makeSuiteAfterEvent('test-app/test/fast.ts', 30, 'SuiteA'));
      cache.onEvent(makeSuiteAfterEvent('test-app/test/fast.ts', 40, 'SuiteB'));
      cache.onEvent(makeSuiteAfterEvent('test-app/test/medium.ts', 400));
      cache.onEvent(makeSuiteAfterEvent('test-app/test/slow.ts', 1000));
      cache.onEvent(makeSuiteAfterEvent('test-app/test/slow.ts', 2000));
      await cache.onSummary();

      // Reload into a fresh instance with medium.ts removed from manifest
      manifest.modules['test-app'].files.test = manifest.modules['test-app'].files.test!.filter(
        entry => entry[0] !== 'test/medium.ts'
      );
      const reloaded = await new TestDurationCache(new ManifestIndex(manifest)).load();

      assert.strictEqual(reloaded.get('test-app/test/fast.ts'), 70);
      assert.strictEqual(reloaded.get('test-app/test/slow.ts'), 1300);
      assert.strictEqual(reloaded.get('test-app/test/medium.ts'), undefined);

      // Gentle front-bias spreads slow files across the run while leaning toward the front vs the end
      const input = [
        { import: 'test-app/test/unknown.ts' },
        { import: 'test-app/test/fast.ts' },
        ...Array.from({ length: 17 }, (_, i) => ({ import: `test-app/test/extra-${i}.ts` })),
        { import: 'test-app/test/slow.ts' }
      ];
      let indexSum = 0;
      let spreadBeyondTopTenPercent = 0;
      for (let i = 0; i < 400; i += 1) {
        const ordered = reloaded.orderRuns(input);
        const indexOfSlow = ordered.findIndex(run => run.import === 'test-app/test/slow.ts');
        indexSum += indexOfSlow;
        if (indexOfSlow >= 2) {
          spreadBeyondTopTenPercent += 1;
        }
      }
      const averageIndex = indexSum / 400;
      assert(averageIndex < input.length * 0.45, `Expected average index < ${input.length * 0.45}, got ${averageIndex}`);
      assert(spreadBeyondTopTenPercent >= 50, `Expected slow test spread beyond top 10%, got ${spreadBeyondTopTenPercent}/400`);
    } finally {
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
