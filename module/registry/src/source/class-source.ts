import { EventEmitter } from 'node:events';

import { type FindConfig } from '@travetto/manifest';
import { Class, Env, Runtime, RuntimeIndex, describeFunction, flushPendingFunctions, registerFunction } from '@travetto/runtime';

import { DynamicFileLoader } from '../internal/file-loader';
import { ChangeSource, ChangeEvent, ChangeHandler } from '../types';

const moduleFindConfig: FindConfig = {
  module: (m) => {
    const role = Env.TRV_ROLE.val;
    return m.roles.includes('std') && (
      !Runtime.production || m.prod ||
      ((role === 'doc' || role === 'test') && m.roles.includes(role))
    );
  },
  folder: f => f === 'src' || f === '$index'
};

function isClass(cls: Function): cls is Class {
  return !!describeFunction(cls).class;
}

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
    for (const cls of flushPendingFunctions().filter(isClass)) {
      const src = Runtime.getSource(cls);
      if (!this.#classes.has(src)) {
        this.#classes.set(src, new Map());
      }
      this.#classes.get(src)!.set(cls.Ⲑid, cls);
      this.emit({ type: 'added', curr: cls });
    }
  }

  /**
   * Process changes for a single file, looking for add/remove/update of classes
   */
  #handleFileChanges(file: string, classes: Class[] = []): number {
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

    // Determine delta based on the various classes (if being added, removed or updated)
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
          const prevHash = describeFunction(prev.get(k)!)?.hash;
          const nextHash = describeFunction(next.get(k)!)?.hash;
          if (prevHash !== nextHash) {
            changes += 1;
            this.emit({ type: 'changed', curr: next.get(k)!, prev: prev.get(k) });
          }
        }
      }
    }
    return changes;
  }

  /**
   * Process all class changes
   */
  #handleChanges(classes: Class[] = []): void {
    const classesByFile = new Map<string, Class[]>();
    for (const el of classes) {
      const source = Runtime.getSource(el);
      if (!classesByFile.has(source)) {
        classesByFile.set(source, []);
      }
      classesByFile.get(source)!.push(el);
    }

    for (const [file, els] of classesByFile.entries()) {
      if (!this.#handleFileChanges(file, els)) {
        this.#emitter.emit('unchanged-file', file);
      }
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
    if (Runtime.dynamic) {
      DynamicFileLoader.onLoadEvent(ev => {
        this.#handleChanges(flushPendingFunctions().filter(isClass));

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