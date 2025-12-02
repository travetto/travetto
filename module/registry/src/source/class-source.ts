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
  trace = Env.DEBUG.value?.includes('@travetto/registry');

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
    for (const key of keys) {
      if (!next.has(key)) {
        changes += 1;
        this.emit({ type: 'removing', prev: prev.get(key)! });
        this.#classes.get(sourceFile)!.delete(key);
      } else {
        this.#classes.get(sourceFile)!.set(key, next.get(key)!);
        if (!prev.has(key)) {
          changes += 1;
          this.emit({ type: 'added', curr: next.get(key)! });
        } else {
          const prevHash = describeFunction(prev.get(key)!)?.hash;
          const nextHash = describeFunction(next.get(key)!)?.hash;
          if (prevHash !== nextHash) {
            changes += 1;
            this.emit({ type: 'changed', curr: next.get(key)!, prev: prev.get(key)! });
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
  emit(event: ChangeEvent<Class>): void {
    if (this.trace) {
      console.debug('Emitting change', {
        type: event.type,
        curr: (event.type !== 'removing' ? event.curr?.Ⲑid : undefined),
        prev: (event.type !== 'added' ? event.prev?.Ⲑid : undefined)
      });
    }
    this.#emitter.emit('change', event);
  }

  /**
   * Initialize
   */
  async init(): Promise<Class[]> {
    if (Runtime.dynamic && !this.#listening) {
      this.#listening = (async (): Promise<void> => {
        for await (const event of await DynamicFileLoader.listen()) {
          if (event.action === 'delete') {
            this.#removeFile(event.file); // File no longer exists
          } else {
            this.#handleChanges(flushPendingFunctions().filter(isClass));
          }

          if (event.action === 'create') {
            this.#flush();
          }
        }
      })();
    }

    // Ensure everything is loaded
    for (const entry of RuntimeIndex.find({
      module: (m) => {
        const role = Env.TRV_ROLE.value;
        return role !== 'test' && // Skip all modules when in test
          m.roles.includes('std') &&
          (
            !Runtime.production || m.prod ||
            (role === 'doc' && m.roles.includes(role))
          );
      },
      folder: f => f === 'src' || f === '$index'
    })) {
      await Runtime.importFrom(entry.import);
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