import { EventEmitter } from 'node:events';

import { Class, Env, Runtime, RuntimeIndex, describeFunction, flushPendingFunctions } from '@travetto/runtime';

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
  #emitter = new EventEmitter<{
    change: [ChangeEvent<Class>];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'unchanged-import': [string];
  }>();
  #listening: Promise<void> | undefined;

  /**
   * Are we in a mode that should have enhanced debug info
   */
  trace = Env.DEBUG.val?.includes('@travetto/registry');

  /**
   * Flush classes
   */
  #flush(): Class[] {
    const flushed = flushPendingFunctions().filter(isClass);
    for (const cls of flushed) {
      const src = Runtime.getSourceFile(cls);
      if (!this.#classes.has(src)) {
        this.#classes.set(src, new Map());
      }
      this.#classes.get(src)!.set(cls.Ⲑid, cls);
      this.emit({ type: 'added', curr: cls });
    }
    return flushed;
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
    const sourceFile = RuntimeIndex.getSourceFile(importFile);

    let prev = new Map<string, Class>();
    if (this.#classes.has(sourceFile)) {
      prev = new Map(this.#classes.get(sourceFile)!.entries());
    }

    const keys = new Set([...Array.from(prev.keys()), ...Array.from(next.keys())]);

    if (!this.#classes.has(sourceFile)) {
      this.#classes.set(sourceFile, new Map());
    }

    let changes = 0;

    // Determine delta based on the various classes (if being added, removed or updated)
    for (const k of keys) {
      if (!next.has(k)) {
        changes += 1;
        this.emit({ type: 'removing', prev: prev.get(k)! });
        this.#classes.get(sourceFile)!.delete(k);
      } else {
        this.#classes.get(sourceFile)!.set(k, next.get(k)!);
        if (!prev.has(k)) {
          changes += 1;
          this.emit({ type: 'added', curr: next.get(k)! });
        } else {
          const prevHash = describeFunction(prev.get(k)!)?.hash;
          const nextHash = describeFunction(next.get(k)!)?.hash;
          if (prevHash !== nextHash) {
            changes += 1;
            this.emit({ type: 'changed', curr: next.get(k)!, prev: prev.get(k)! });
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
      console.debug('Emitting change', {
        type: e.type,
        curr: (e.type !== 'removing' ? e.curr?.Ⲑid : undefined),
        prev: (e.type !== 'added' ? e.prev?.Ⲑid : undefined)
      });
    }
    this.#emitter.emit('change', e);
  }

  /**
   * Initialize
   */
  async init(): Promise<Class[]> {
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

    if (Env.TRV_ROLE.val === 'test') {
      // We do not auto load in test mode
    } else {
      // Ensure everything is loaded
      for (const entry of RuntimeIndex.find({
        module: (m) => {
          const role = Env.TRV_ROLE.val;
          return m.roles.includes('std') && (
            !Runtime.production || m.prod ||
            (role === 'doc' && m.roles.includes(role))
          );
        },
        folder: f => f === 'src' || f === '$index'
      })) {
        await Runtime.importFrom(entry.import);
      }
    }

    // Flush all load events
    return this.#flush();
  }

  /**
   * Add callback for change events
   */
  on(callback: ChangeHandler<Class>): void {
    this.#emitter.on('change', callback);
  }

  /**
   * Add callback for change events
   */
  off(callback: ChangeHandler<Class>): void {
    this.#emitter.off('change', callback);
  }

  /**
   * Add callback for when a import is changed, but emits no class changes
   */
  onNonClassChanges(callback: (imp: string) => void): void {
    this.#emitter.on('unchanged-import', callback);
  }
}