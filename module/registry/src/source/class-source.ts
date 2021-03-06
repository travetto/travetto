import { EventEmitter } from 'events';

import { Class } from '@travetto/base';
import { Compiler } from '@travetto/compiler';

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

  constructor() {
    Compiler
      .on('added', () => { this.processFiles(); this.#flush(); })
      .on('changed', () => this.processFiles());
  }

  /**
   * Flush classes
   */
  #flush() {
    for (const [file, classes] of PendingRegister.flush()) {
      if (!classes || !classes.length) {
        continue;
      }
      this.#classes.set(file, new Map());
      for (const cls of classes) {
        this.#classes.get(cls.ᚕfile)!.set(cls.ᚕid, cls);
        this.emit({ type: 'added', curr: cls });
      }
    }
  }

  /**
   * Listen for a single file, and process all the classes within
   */
  async #handleFileChanges(file: string, classes: Class[] = []) {
    const next = new Map(classes.map(cls => [cls.ᚕid, cls] as [string, Class]));

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
        } else if (prev.get(k)!.ᚕhash !== next.get(k)!.ᚕhash) {
          this.emit({ type: 'changed', curr: next.get(k)!, prev: prev.get(k) });
        }
      }
    }
  }

  /**
   * Flush all pending classes
   */
  processFiles() {
    console.debug('Pending changes', { changes: PendingRegister.ordered.map(([, x]) => x.map(y => y.ᚕid)) });
    for (const [file, classes] of PendingRegister.flush()) {
      this.#handleFileChanges(file, classes);
    }
  }

  /**
   * Emit a change event
   */
  emit(e: ChangeEvent<Class>) {
    console.debug('Emitting change', { type: e.type, curr: e.curr?.ᚕid, prev: e.prev?.ᚕid });
    this.#emitter.emit('change', e);
  }

  /**
   * Clear all classes
   */
  reset() {
    this.#classes.clear();
  }

  /**
   * Initialize
   */
  async init() {
    this.#flush();
  }

  /**
   * Add callback for change events
   */
  on(callback: ChangeHandler<Class>): void {
    this.#emitter.on('change', callback);
  }
}