import { Class, ClassInstance, describeFunction } from '@travetto/runtime';
import { RetargettingProxy } from '@travetto/registry';

import type { DependencyRegistry, ResolutionType, Resolved } from '../src/registry';
import type { ClassTarget, InjectableConfig } from '../src/types';

/**
 * Wraps the Dependency Registry to support proxying instances
 */
class $DynamicDependencyRegistry {
  #proxies = new Map<string, Map<symbol | undefined, RetargettingProxy<unknown>>>();
  #registry: typeof DependencyRegistry;
  #registryCreateInstance: <T>(target: ClassTarget<T>, qualifier: symbol) => Promise<T>;
  #registryResolveTarget: <T>(target: ClassTarget<T>, qualifier?: symbol, resolution?: ResolutionType) => Resolved<T>;
  #registryOnInstallFinalize: <T>(target: Class<T>) => InjectableConfig<T>;
  #registryDestroyInstance: <T>(target: Class<T>, qualifier: symbol) => void;

  /**
   * Proxy the created instance
   */
  proxyInstance<T>(target: ClassTarget<T>, qual: symbol | undefined, instance: T): T {
    const { qualifier, id: classId } = this.#registryResolveTarget(target, qual);
    let proxy: RetargettingProxy<unknown>;

    if (!this.#proxies.has(classId)) {
      this.#proxies.set(classId, new Map());
    }

    if (!this.#proxies.get(classId)!.has(qualifier)) {
      proxy = new RetargettingProxy<T>(instance);
      this.#proxies.get(classId)!.set(qualifier, proxy);
      if (this.#registry.trace) {
        console.debug('Registering proxy', { id: target.Ⲑid, qualifier: qualifier.toString() });
      }
    } else {
      proxy = this.#proxies.get(classId)!.get(qualifier)!;
      proxy.setTarget(instance);
      if (this.#registry.trace) {
        console.debug('Updating target', {
          id: target.Ⲑid, qualifier: qualifier.toString(), instanceType: target.name
        });
      }
    }

    return proxy.get<T>();
  }

  /**
   * Create instance and wrap in a proxy
   */
  async createInstance<T>(target: ClassTarget<T>, qualifier: symbol): Promise<T> {
    const instance = await this.#registryCreateInstance(target, qualifier);
    const classId = this.#registryResolveTarget(target, qualifier).id;
    // Reset as proxy instance
    const proxied = this.proxyInstance<T>(target, qualifier, instance);
    this.#registry['instances'].get(classId)!.set(qualifier, proxied);
    return proxied;
  }

  /**
   * Reload proxy if in watch mode
   */
  onInstallFinalize<T>(cls: Class<T>): InjectableConfig<T> {
    const config = this.#registryOnInstallFinalize(cls);
    // If already loaded, reload
    const classId = cls.Ⲑid;

    if (
      !describeFunction(cls)?.abstract &&
      this.#proxies.has(classId) &&
      this.#proxies.get(classId)!.has(config.qualifier)
    ) {
      console.debug('Reloading on next tick');
      // Timing matters due to create instance being asynchronous
      process.nextTick(() => this.createInstance(config.target, config.qualifier));
    }

    return config;
  }

  destroyInstance(cls: Class, qualifier: symbol): void {
    const classId = cls.Ⲑid;
    const proxy = this.#proxies.get(classId)?.get(qualifier);
    this.#registryDestroyInstance(cls, qualifier);
    if (proxy) {
      proxy.setTarget(null);
    }
  }

  register(registry: typeof DependencyRegistry): void {
    this.#registry = registry;
    this.#registryCreateInstance = registry['createInstance'].bind(registry);
    this.#registryResolveTarget = registry['resolveTarget'].bind(registry);
    this.#registryOnInstallFinalize = registry['onInstallFinalize'].bind(registry);
    this.#registryDestroyInstance = registry['destroyInstance'].bind(registry);

    this.#registry['createInstance'] = this.createInstance.bind(this);
    this.#registry['destroyInstance'] = this.destroyInstance.bind(this);
    this.#registry['onInstallFinalize'] = this.onInstallFinalize.bind(this);
  }
}

export const DependencyRegistration = {
  init(registry: typeof DependencyRegistry): void {
    const dynamic = new $DynamicDependencyRegistry();
    dynamic.register(registry);
  }
};