import type { DependencyRegistry } from '@travetto/di/src/registry';
import type { ClassTarget } from '@travetto/di/src/types';
import type { Class } from '@travetto/registry';
import { RetargettingProxy } from './proxy';

/**
 * Wraps the Dependency Registry to support proxying instances
 */
export function DiAdaptor($DependencyRegistry: { new(...args: any[]): typeof DependencyRegistry }) {

  const { DEFAULT_INSTANCE } = require('@travetto/di/src/registry');

  /**
   * Extending the $DependencyRegistry class to add some functionality for watching
   */
  const Cls = class extends $DependencyRegistry {
    private proxies = new Map<string, Map<symbol, RetargettingProxy<any>>>();

    /**
     * Proxy the created instance
     */
    protected proxyInstance<T>(target: ClassTarget<T>, qualifier: symbol, instance: T): RetargettingProxy<T> {
      const classId = this.resolveClassId(target, qualifier);
      let proxy: RetargettingProxy<T>;

      if (!this.proxies.has(classId)) {
        this.proxies.set(classId, new Map());
      }

      if (!this.proxies.get(classId)!.has(qualifier)) {
        proxy = new RetargettingProxy(instance);
        this.proxies.get(classId)!.set(qualifier, proxy);
        console.trace('Registering proxy', target.__id, qualifier);
      } else {
        proxy = this.proxies.get(classId)!.get(qualifier)!;
        proxy.setTarget(instance);
        console.trace('Updating target', target.__id, qualifier, instance);
      }

      return proxy;
    }

    /**
     * Create instance and wrap in a proxy
     */
    protected async createInstance<T>(target: ClassTarget<T>, qualifier: symbol = DEFAULT_INSTANCE) {
      const instance = await super.createInstance(target, qualifier);
      const classId = this.resolveClassId(target, qualifier);
      // Reset as proxy instance
      const proxied = this.proxyInstance(target, qualifier, instance);
      this.instances.get(classId)!.set(qualifier, proxied.get());
      return proxied.get();
    }

    /**
     * Reload proxy if in watch mode
     */
    onInstallFinalize<T>(cls: Class<T>) {
      const config = super.onInstallFinalize(cls);

      const classId = cls.__id;

      // If already loaded, reload
      if (
        !cls.__abstract &&
        this.proxies.has(classId) &&
        this.proxies.get(classId)!.has(config.qualifier)
      ) {
        console.debug('Reloading on next tick');
        // Timing matters due to create instance being asynchronous
        process.nextTick(() => this.createInstance(config.target, config.qualifier));
      }

      return config;
    }

    destroyInstance(cls: Class, qualifier: symbol) {
      const classId = cls.__id;
      const proxy = this.proxies.get(classId)!.get(qualifier);
      super.destroyInstance(cls, qualifier);
      if (proxy) {
        proxy.setTarget(null);
      }
    }

    onReset() {
      super.reset();
      this.proxies.clear();
    }
  };

  Object.defineProperty(Cls, 'name', { value: '$DependencyRegistry' });
  return Cls;
}