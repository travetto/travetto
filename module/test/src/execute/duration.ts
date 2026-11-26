import fs from 'node:fs/promises';

import { type ManifestIndex, path } from '@travetto/manifest';
import { JSONUtil, RuntimeIndex } from '@travetto/runtime';

import type { TestConsumerShape } from '../consumer/types.ts';
import type { TestEvent } from '../model/event.ts';
import type { TestRun } from '../model/test.ts';

const FLUSH_INTERVAL_MILLISECONDS = 30_000;
const PREVIOUS_WEIGHT = 0.7;

/**
 * Shared persistent cache of per-suite execution durations (.trv/tool/test-durations.json)
 */
export class TestDurationCache implements TestConsumerShape {
  #index: ManifestIndex;
  #durations = new Map<string, Map<string, number>>();
  #flushTimer?: ReturnType<typeof setTimeout>;
  #dirty = false;

  constructor(index: ManifestIndex = RuntimeIndex) {
    this.#index = index;
  }

  #getCacheFile(): string {
    return path.resolve(this.#index.manifest.workspace.path, this.#index.manifest.build.toolFolder, 'test-durations.json');
  }

  #scheduleSave(): void {
    this.#dirty = true;
    if (this.#flushTimer) {
      return;
    }
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = undefined;
      void this.save();
    }, FLUSH_INTERVAL_MILLISECONDS);
    this.#flushTimer.unref?.();
  }

  /**
   * Sum stored suite durations for a test file import
   */
  get(importName: string): number | undefined {
    const suites = this.#durations.get(importName);
    if (!suites || suites.size === 0) {
      return undefined;
    }
    let total = 0;
    for (const duration of suites.values()) {
      total += duration;
    }
    return total;
  }

  delete(importName: string): void {
    if (this.#durations.delete(importName)) {
      this.#scheduleSave();
    }
  }

  /**
   * Order test runs uniformly with a gentle logarithmic front-bias for slower suites
   */
  orderRuns<T extends Pick<TestRun, 'import'>>(runs: T[]): T[] {
    return runs
      .map(run => {
        const duration = this.get(run.import) ?? 0;
        const bias = Math.min(0.4, Math.log10(1 + duration / 1000) * 0.25);
        return { run, score: Math.random() + bias };
      })
      .sort((a, b) => b.score - a.score)
      .map(item => item.run);
  }

  onEvent(event: TestEvent): void {
    if (event.type === 'suite' && event.phase === 'after') {
      const suites = this.#durations.getOrInsert(event.suite.import, new Map());
      const previous = suites.get(event.suite.classId);
      const next =
        previous === undefined
          ? event.suite.duration
          : Math.round(previous * PREVIOUS_WEIGHT + event.suite.duration * (1 - PREVIOUS_WEIGHT));
      suites.set(event.suite.classId, next);
      this.#scheduleSave();
    }
  }

  async onSummary(): Promise<void> {
    if (this.#dirty) {
      await this.save();
    }
  }

  /**
   * Load cached per-suite durations from disk
   */
  async load(): Promise<this> {
    try {
      const parsed = JSONUtil.fromUTF8<Record<string, Record<string, number>>>(await fs.readFile(this.#getCacheFile(), 'utf8'));
      for (const [importName, suiteMap] of Object.entries(parsed ?? {})) {
        if (!suiteMap || typeof suiteMap !== 'object' || !this.#index.getFromImport(importName)) {
          continue;
        }
        const suites = new Map<string, number>();
        for (const [classId, duration] of Object.entries(suiteMap)) {
          if (typeof duration === 'number') {
            suites.set(classId, duration);
          }
        }
        if (suites.size > 0) {
          this.#durations.set(importName, suites);
        }
      }
    } catch {
      // No cached durations on disk yet
    }
    return this;
  }

  /**
   * Persist cached per-suite durations to disk
   */
  async save(): Promise<void> {
    if (this.#flushTimer) {
      clearTimeout(this.#flushTimer);
      this.#flushTimer = undefined;
    }
    this.#dirty = false;
    const cacheFile = this.#getCacheFile();
    try {
      await fs.mkdir(path.dirname(cacheFile), { recursive: true });
      const payload = Object.fromEntries([...this.#durations.entries()].map(([importName, suites]) => [importName, Object.fromEntries(suites)]));
      await fs.writeFile(cacheFile, JSONUtil.toUTF8(payload), 'utf8');
    } catch {
      // Ignore cache write errors
    }
  }
}
