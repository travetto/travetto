import { EventEmitter } from 'events';

import { Class } from '@travetto/base';
import { Dynamic } from '@travetto/boot';

import { ChangeSource, ChangeEvent, ChangeHandler } from '../types';
import { PendingRegister } from '../decorator';

/**
 * A class change source. Meant to be hooked into the
 * compiler as a way to listen to changes via the compiler
 * watching.
 */
@Dynamic('@travetto/registry/support/dynamic.class-source')
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
        this.#classes.get(cls.Ⲑfile)!.set(cls.Ⲑid, cls);
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
        } else if (prev.get(k)!.Ⲑmeta?.hash !== next.get(k)!.Ⲑmeta?.hash) {
          this.emit({ type: 'changed', curr: next.get(k)!, prev: prev.get(k) });
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
   * Clear all classes
   */
  reset(): void {
    this.#classes.clear();
  }

  /**
   * Initialize
   */
  async init(): Promise<void> {
    this.#flush();
  }

  /**
   * Add callback for change events
   */
  on(callback: ChangeHandler<Class>): void {
    this.#emitter.on('change', callback);
  }
}