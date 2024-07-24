import { EventEmitter } from 'node:events';

import { type FindConfig, MetadataIndex } from '@travetto/manifest';
import { Class, Env, RuntimeIndex } from '@travetto/base';

import { DynamicFileLoader } from '../internal/file-loader';
import { ChangeSource, ChangeEvent, ChangeHandler } from '../types';
import { PendingRegister } from '../decorator';

const moduleFindConfig: FindConfig = {
  module: (m) => {
    const role = Env.TRV_ROLE.val;
    return m.roles.includes('std') && (
      !Env.production || m.prod ||
      ((role === 'doc' || role === 'test') && m.roles.includes(role))
    );
  },
  folder: f => f === 'src' || f === '$index'
};

/**
 * A class change source. Meant to be hooked into the
 * compiler as a way to listen to changes via the compiler
 * watching.
 */
export class ClassSource implements ChangeSource<Class> {

  #classes = new Map<string, Map<string, Class>>();
  #emitter = new EventEmitter();

  /**
   * Are we in a mode that should have enhanced debug info
   */
  trace = Env.DEBUG.val?.includes('@travetto/registry');

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
        const src = RuntimeIndex.getSourceFile(MetadataIndex.get(cls)!);
        this.#classes.get(src)!.set(cls.Ⲑid, cls);
        this.emit({ type: 'added', curr: cls });
      }
    }
  }

  /**
   * Listen for a single file, and process all the classes within
   */
  #handleFileChanges(file: string, classes: Class[] = []): void {
    const next = new Map<string, Class>(classes.map(cls => [cls.Ⲑid, cls] as const));

    let prev = new Map<string, Class>();
    if (this.#classes.has(file)) {
      prev = new Map(this.#classes.get(file)!.entries());
    }

    const keys = new Set([...Array.from(prev.keys()), ...Array.from(next.keys())]);

    if (!this.#classes.has(file)) {
      this.#classes.set(file, new Map());
    }

    let changes = 0;

    /**
     * Determine delta based on the various classes (if being added, removed or updated)
     */
    for (const k of keys) {
      if (!next.has(k)) {
        changes += 1;
        this.emit({ type: 'removing', prev: prev.get(k)! });
        this.#classes.get(file)!.delete(k);
      } else {
        this.#classes.get(file)!.set(k, next.get(k)!);
        if (!prev.has(k)) {
          changes += 1;
          this.emit({ type: 'added', curr: next.get(k)! });
        } else {
          const prevMeta = MetadataIndex.getFromClass(prev.get(k));
          const nextMeta = MetadataIndex.getFromClass(next.get(k));
          if (prevMeta?.hash !== nextMeta?.hash) {
            changes += 1;
            this.emit({ type: 'changed', curr: next.get(k)!, prev: prev.get(k) });
          }
        }
      }
    }
    if (!changes) {
      this.#emitter.emit('unchanged-file', file);
    }
  }

  /**
   * Emit a change event
   */
  emit(e: ChangeEvent<Class>): void {
    if (this.trace) {
      console.debug('Emitting change', { type: e.type, curr: e.curr?.Ⲑid, prev: e.prev?.Ⲑid });
    }
    this.#emitter.emit('change', e);
  }

  /**
   * Initialize
   */
  async init(): Promise<void> {
    if (Env.dynamic) {
      DynamicFileLoader.onLoadEvent(ev => {
        for (const [file, classes] of PendingRegister.flush(true)) {
          this.#handleFileChanges(file, classes);
        }
        if (ev.action === 'create') {
          this.#flush();
        }
      });
      await DynamicFileLoader.init();
    }

    // Ensure everything is loaded
    for (const mod of RuntimeIndex.find(moduleFindConfig)) {
      await import(mod.import);
    }

    // Flush all load events
    this.#flush();
  }

  /**
   * Add callback for change events
   */
  on(callback: ChangeHandler<Class>): void {
    this.#emitter.on('change', callback);
  }

  /**
   * Add callback for when a file is changed, but emits no class changes
   */
  onNonClassChanges(callback: (file: string) => void): void {
    this.#emitter.on('unchanged-file', callback);
  }
}