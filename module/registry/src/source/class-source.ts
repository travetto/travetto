import { EventEmitter } from 'events';

import { RootIndex } from '@travetto/manifest';
import { Class, GlobalEnv } from '@travetto/base';

import { ChangeSource, ChangeEvent, ChangeHandler } from '../types';
import { PendingRegister } from '../decorator';

/**
 * A class change source. Meant to be hooked into the
 * compiler as a way to listen to changes via the compiler
 * watching.
 */
export class ClassSource implements ChangeSource<Class> {

  #classes = new Map<string, Map<string, Class>>();
  #emitter = new EventEmitter();

  /**
   * Flush classes
   */
  #flush(): void {
    for (const [file, classes] of PendingRegister.flush()) {
      if (!classes || !classes.length) {
        continue;
      }
      this.#classes.set(file, new Map());
      for (const cls of classes) {
        const src = RootIndex.getFunctionMetadata(cls)!.source;
        this.#classes.get(src)!.set(cls.Ⲑid, cls);
        this.emit({ type: 'added', curr: cls });
      }
    }
  }

  /**
   * Listen for a single file, and process all the classes within
   */
  async #handleFileChanges(file: string, classes: Class[] = []): Promise<void> {
    const next = new Map<string, Class>(classes.map(cls => [cls.Ⲑid, cls] as const));

    let prev = new Map<string, Class>();
    if (this.#classes.has(file)) {
      prev = new Map(this.#classes.get(file)!.entries());
    }

    const keys = new Set([...Array.from(prev.keys()), ...Array.from(next.keys())]);

    if (!this.#classes.has(file)) {
      this.#classes.set(file, new Map());
    }

    /**
     * Determine delta based on the various classes (if being added, removed or updated)
     */
    for (const k of keys) {
      if (!next.has(k)) {
        this.emit({ type: 'removing', prev: prev.get(k)! });
        this.#classes.get(file)!.delete(k);
      } else {
        this.#classes.get(file)!.set(k, next.get(k)!);
        if (!prev.has(k)) {
          this.emit({ type: 'added', curr: next.get(k)! });
        } else {
          const prevMeta = RootIndex.getFunctionMetadataFromClass(prev.get(k));
          const nextMeta = RootIndex.getFunctionMetadataFromClass(next.get(k));
          if (prevMeta?.hash !== nextMeta?.hash) {
            this.emit({ type: 'changed', curr: next.get(k)!, prev: prev.get(k) });
          }
        }
      }
    }
  }

  /**
   * Flush all pending classes
   */
  processFiles(flush = false): void {
    console.debug('Pending changes', { changes: PendingRegister.ordered.map(([, x]) => x.map(y => y.Ⲑid)) });
    for (const [file, classes] of PendingRegister.flush()) {
      this.#handleFileChanges(file, classes);
    }
    if (flush) {
      this.#flush();
    }
  }

  /**
   * Emit a change event
   */
  emit(e: ChangeEvent<Class>): void {
    console.debug('Emitting change', { type: e.type, curr: e.curr?.Ⲑid, prev: e.prev?.Ⲑid });
    this.#emitter.emit('change', e);
  }

  /**
   * Initialize
   */
  async init(): Promise<void> {
    if (GlobalEnv.dynamic) {
      const { DynamicClassSource } = await import('../../support/dynamic.class-source.js');
      await DynamicClassSource.init(this);
    }

    // Ensure everything is loaded
    await RootIndex.loadSource();

    // Flush all load events
    this.#flush();
  }

  /**
   * Add callback for change events
   */
  on(callback: ChangeHandler<Class>): void {
    this.#emitter.on('change', callback);
  }
}