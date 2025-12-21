import { Class, Env, Runtime, RuntimeIndex, flushPendingFunctions, isClass } from '@travetto/runtime';

/**
 * A class change source. Meant to be hooked into the
 * compiler as a way to listen to changes via the compiler
 * watching.
 */
export class ClassSource {

  static #instance = new ClassSource();

  static init(): Promise<Class[]> {
    return this.#instance.init();
  }

  #classes = new Map<string, Map<string, Class>>();

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
    }
    return flushed;
  }

  /**
   * Initialize
   */
  async init(): Promise<Class[]> {
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
}