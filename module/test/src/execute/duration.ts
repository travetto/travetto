import fs from 'node:fs/promises';

import { type ManifestIndex, path } from '@travetto/manifest';
import { JSONUtil, RuntimeIndex } from '@travetto/runtime';

import type { TestConsumerShape } from '../consumer/types.ts';
import type { TestEvent } from '../model/event.ts';
import type { TestRun } from '../model/test.ts';

const FLUSH_INTERVAL_MILLISECONDS = 30_000;

/**
 * Shared persistent cache of suite execution durations (.trv/tool/test-durations.json)
 */
export class TestDurationCache implements TestConsumerShape {
  #index: ManifestIndex;
  #durations = new Map<string, number>();
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

  get(importName: string): number | undefined {
    return this.#durations.get(importName);
  }

  delete(importName: string): void {
    if (this.#durations.delete(importName)) {
      this.#scheduleSave();
    }
  }

  /**
   * Sort test runs slowest-first so long-running suites start early in WorkPool execution
   */
  sortSlowestFirst<T extends Pick<TestRun, 'import'>>(runs: T[]): T[] {
    return [...runs].sort((a, b) => {
      const durationA = this.#durations.get(a.import);
      const durationB = this.#durations.get(b.import);
      if (durationA !== undefined && durationB !== undefined) {
        return durationB - durationA;
      }
      if (durationA !== undefined) {
        return -1;
      }
      if (durationB !== undefined) {
        return 1;
      }
      return Math.random() < 0.5 ? -1 : 1;
    });
  }

  onEvent(event: TestEvent): void {
    if (event.type === 'suite' && event.phase === 'after') {
      this.#durations.set(event.suite.import, event.suite.duration);
      this.#scheduleSave();
    }
  }

  async onSummary(): Promise<void> {
    if (this.#dirty) {
      await this.save();
    }
  }

  /**
   * Load cached suite durations from disk
   */
  async load(): Promise<this> {
    try {
      const parsed = JSONUtil.fromUTF8<Record<string, number>>(await fs.readFile(this.#getCacheFile(), 'utf8'));
      for (const [importName, duration] of Object.entries(parsed ?? {})) {
        if (typeof duration === 'number' && this.#index.getFromImport(importName)) {
          this.#durations.set(importName, duration);
        }
      }
    } catch {
      // No cached durations on disk yet
    }
    return this;
  }

  /**
   * Persist cached suite durations to disk
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
      await fs.writeFile(cacheFile, JSONUtil.toUTF8(Object.fromEntries(this.#durations)), 'utf8');
    } catch {
      // Ignore cache write errors
    }
  }
}
