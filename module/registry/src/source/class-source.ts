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
      const source = Runtime.getSourceFile(cls);
      if (!this.#classes.has(source)) {
        this.#classes.set(source, new Map());
      }
      this.#classes.get(source)!.set(cls.Ⲑid, cls);
      this.emit({ type: 'added', current: cls });
    }
    return flushed;
  }

  #removeFile(file: string): void {
    const data = this.#classes.get(file);
    if (data) {
      this.#classes.delete(file);
      for (const cls of data) {
        this.emit({ type: 'removing', previous: cls[1] });
      }
    }
  }

  /**
   * Process changes for a single file, looking for add/remove/update of classes
   */
  #handleFileChanges(importFile: string, classes: Class[] = []): number {
    const next = new Map<string, Class>(classes.map(cls => [cls.Ⲑid, cls] as const));
    const sourceFile = RuntimeIndex.getSourceFile(importFile);

    let previous = new Map<string, Class>();
    if (this.#classes.has(sourceFile)) {
      previous = new Map(this.#classes.get(sourceFile)!.entries());
    }

    const keys = new Set([...Array.from(previous.keys()), ...Array.from(next.keys())]);

    if (!this.#classes.has(sourceFile)) {
      this.#classes.set(sourceFile, new Map());
    }

    let changes = 0;

    // Determine delta based on the various classes (if being added, removed or updated)
    for (const key of keys) {
      if (!next.has(key)) {
        changes += 1;
        this.emit({ type: 'removing', previous: previous.get(key)! });
        this.#classes.get(sourceFile)!.delete(key);
      } else {
        this.#classes.get(sourceFile)!.set(key, next.get(key)!);
        if (!previous.has(key)) {
          changes += 1;
          this.emit({ type: 'added', current: next.get(key)! });
        } else {
          const prevHash = describeFunction(previous.get(key)!)?.hash;
          const nextHash = describeFunction(next.get(key)!)?.hash;
          if (prevHash !== nextHash) {
            changes += 1;
            this.emit({ type: 'changed', current: next.get(key)!, previous: previous.get(key)! });
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
    for (const cls of classes) {
      const importPath = Runtime.getImport(cls);
      if (!classesByFile.has(importPath)) {
        classesByFile.set(importPath, []);
      }
      classesByFile.get(importPath)!.push(cls);
    }

    for (const [importPath, items] of classesByFile.entries()) {
      if (!this.#handleFileChanges(importPath, items)) {
        this.#emitter.emit('unchanged-import', importPath);
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
        current: (event.type !== 'removing' ? event.current?.Ⲑid : undefined),
        previous: (event.type !== 'added' ? event.previous?.Ⲑid : undefined)
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
      module: (mod) => {
        const role = Env.TRV_ROLE.value;
        return role !== 'test' && // Skip all modules when in test
          mod.roles.includes('std') &&
          (
            !Runtime.production || mod.prod ||
            (role === 'doc' && mod.roles.includes(role))
          );
      },
      folder: folder => folder === 'src' || folder === '$index'
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