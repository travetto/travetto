import { EventEmitter } from 'node:events';

import { Class, Env, Runtime, RuntimeIndex, WatchEvent, describeFunction, flushPendingFunctions } from '@travetto/runtime';

import { DynamicFileLoader } from '../internal/file-loader.ts';
import { ChangeSource, ChangeEvent, ChangeHandler } from '../types.ts';

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
  #listening: Promise<void> | undefined;

  /**
   * Are we in a mode that should have enhanced debug info
   */
  trace = Env.DEBUG.val?.includes('@travetto/registry');

  /**
   * Flush classes
   */
  #flush(): void {
    for (const cls of flushPendingFunctions().filter(isClass)) {
      const src = Runtime.getSourceFile(cls);
      if (!this.#classes.has(src)) {
        this.#classes.set(src, new Map());
      }
      this.#classes.get(src)!.set(cls.Ⲑid, cls);
      this.emit({ type: 'added', curr: cls });
    }
  }

  #removeFile(file: string): void {
    const data = this.#classes.get(file);
    if (data) {
      this.#classes.delete(file);
      for (const cls of data) {
        this.emit({ type: 'removing', prev: cls[1] });
      }
    }
  }

  /**
   * Process changes for a single file, looking for add/remove/update of classes
   */
  #handleFileChanges(importFile: string, classes: Class[] = []): number {
    const next = new Map<string, Class>(classes.map(cls => [cls.Ⲑid, cls] as const));
    const src = RuntimeIndex.getSourceFile(importFile);

    let prev = new Map<string, Class>();
    if (this.#classes.has(src)) {
      prev = new Map(this.#classes.get(src)!.entries());
    }

    const keys = new Set([...Array.from(prev.keys()), ...Array.from(next.keys())]);

    if (!this.#classes.has(src)) {
      this.#classes.set(src, new Map());
    }

    let changes = 0;

    // Determine delta based on the various classes (if being added, removed or updated)
    for (const k of keys) {
      if (!next.has(k)) {
        changes += 1;
        this.emit({ type: 'removing', prev: prev.get(k)! });
        this.#classes.get(src)!.delete(k);
      } else {
        this.#classes.get(src)!.set(k, next.get(k)!);
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
      const imp = Runtime.getImport(el);
      if (!classesByFile.has(imp)) {
        classesByFile.set(imp, []);
      }
      classesByFile.get(imp)!.push(el);
    }

    for (const [imp, els] of classesByFile.entries()) {
      if (!this.#handleFileChanges(imp, els)) {
        this.#emitter.emit('unchanged-import', imp);
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
    if (Runtime.dynamic && !this.#listening) {
      this.#listening = (async (): Promise<void> => {
        for await (const ev of await DynamicFileLoader.listen()) {
          if (ev.action === 'delete') {
            this.#removeFile(ev.file); // File no longer exists
          } else {
            this.#handleChanges(flushPendingFunctions().filter(isClass));
          }

          if (ev.action === 'create') {
            this.#flush();
          }
        }
      })();
    }

    // Ensure everything is loaded
    for (const entry of RuntimeIndex.find({
      module: (m) => {
        const role = Env.TRV_ROLE.val;
        return m.roles.includes('std') && (
          !Runtime.production || m.prod ||
          ((role === 'doc' || role === 'test') && m.roles.includes(role))
        );
      },
      folder: f => f === 'src' || f === '$index'
    })) {
      await Runtime.importFrom(entry.import);
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
   * Add callback for when a import is changed, but emits no class changes
   */
  onNonClassChanges(callback: (imp: string) => void): void {
    this.#emitter.on('unchanged-import', callback);
  }
}