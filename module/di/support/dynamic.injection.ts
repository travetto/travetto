import { RetargettingProxy } from '@travetto/base/src/internal/proxy';
import { Class, ClassInstance } from '@travetto/base';

import type { DependencyRegistry } from '../src/registry';
import type { ClassTarget } from '../src/types';

/**
 * Wraps the Dependency Registry to support proxying instances
 */
export function init($DependencyRegistry: Class<typeof DependencyRegistry>) {

  /**
   * Extending the $DependencyRegistry class to add some functionality for watching
   */
  const Cls = class extends $DependencyRegistry {
    #proxies = new Map<string, Map<symbol | undefined, RetargettingProxy<unknown>>>();

    /**
     * Proxy the created instance
     */
    protected proxyInstance<T>(target: ClassTarget<T>, qual: symbol | undefined, instance: T): T {
      const { qualifier, id: classId } = this.resolveTarget(target, qual);
      let proxy: RetargettingProxy<unknown>;

      if (!this.#proxies.has(classId)) {
        this.#proxies.set(classId, new Map());
      }

      if (!this.#proxies.get(classId)!.has(qualifier)) {
        proxy = new RetargettingProxy<unknown>(instance);
        this.#proxies.get(classId)!.set(qualifier, proxy);
        console.debug('Registering proxy', { id: target.ᚕid, qualifier: qualifier.toString() });
      } else {
        proxy = this.#proxies.get(classId)!.get(qualifier)! as RetargettingProxy<unknown>;
        proxy.setTarget(instance);
        console.debug('Updating target', {
          id: target.ᚕid, qualifier: qualifier.toString(), instanceType: (instance as unknown as ClassInstance<T>).constructor.name as string
        });
      }

      return proxy.get() as T;
    }

    /**
     * Create instance and wrap in a proxy
     */
    protected async createInstance<T>(target: ClassTarget<T>, qualifier: symbol) {
      const instance = await super.createInstance(target, qualifier);
      const classId = this.resolveTarget(target, qualifier).id;
      // Reset as proxy instance
      const proxied = this.proxyInstance(target, qualifier, instance);
      this.instances.get(classId)!.set(qualifier, proxied);
      return proxied;
    }

    /**
     * Reload proxy if in watch mode
     */
    onInstallFinalize<T>(cls: Class<T>) {
      const config = super.onInstallFinalize(cls);
      // If already loaded, reload
      const classId = cls.ᚕid;

      if (
        !cls.ᚕabstract &&
        this.#proxies.has(classId) &&
        this.#proxies.get(classId)!.has(config.qualifier)
      ) {
        console.debug('Reloading on next tick');
        // Timing matters due to create instance being asynchronous
        process.nextTick(() => this.createInstance(config.target, config.qualifier));
      }

      return config;
    }

    destroyInstance(cls: Class, qualifier: symbol) {
      const classId = cls.ᚕid;
      const proxy = this.#proxies.get(classId)!.get(qualifier);
      super.destroyInstance(cls, qualifier);
      if (proxy) {
        proxy.setTarget(null);
      }
    }

    onReset() {
      super.onReset();
      this.#proxies.clear();
    }
  };

  return Cls;
}