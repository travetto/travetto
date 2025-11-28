import { ChangeEvent, RegistryIndex, RegistryIndexStore, Registry } from '@travetto/registry';
import { Class, ClassInstance, getClass, RetainPrimitiveFields } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ControllerRegistryAdapter } from './registry-adapter';
import { ControllerConfig, EndpointConfig, EndpointDecorator } from './types';
import { WebAsyncContext } from '../context';
import type { WebInterceptor } from '../types/interceptor.ts';

const isClass = (property: unknown, target: unknown): target is Class => !property;

export class ControllerRegistryIndex implements RegistryIndex {

  static #instance = Registry.registerIndex(this);

  static getClasses(): Class[] {
    return this.#instance.store.getClasses();
  }

  static getForRegister(cls: Class): ControllerRegistryAdapter {
    return this.#instance.store.getForRegister(cls);
  }

  static getConfig(cls: Class): ControllerConfig {
    return this.#instance.store.get(cls).get();
  }

  static getEndpointConfigById(id: string): EndpointConfig | undefined {
    return this.#instance.getEndpointById(id);
  }

  static bindContextParamsOnPostConstruct(cls: Class): void {
    this.#instance.bindContextParamsOnPostConstruct(cls);
  }

  /**
   * Register a controller/endpoint with specific config for an interceptor
   * @param cls The interceptor to register data for
   * @param cfg The partial config override
   */
  static createInterceptorConfigDecorator<T extends WebInterceptor>(
    cls: Class<T>,
    cfg: Partial<RetainPrimitiveFields<T['config']>>,
    extra?: Partial<EndpointConfig & ControllerConfig>
  ): EndpointDecorator {
    return (instanceOrCls: Class | ClassInstance, property?: symbol | string): void => {
      const adapter = ControllerRegistryIndex.getForRegister(getClass(instanceOrCls));
      if (isClass(property, instanceOrCls)) {
        adapter.registerInterceptorConfig(cls, cfg, extra);
      } else {
        adapter.registerEndpointInterceptorConfig(property!, cls, cfg, extra);
      }
    };
  }

  #endpointsById = new Map<string, EndpointConfig>();

  store = new RegistryIndexStore(ControllerRegistryAdapter);

  async #bindContextParams<T>(instance: ClassInstance<T>): Promise<void> {
    const ctx = await DependencyRegistryIndex.getInstance(WebAsyncContext);
    const cls = getClass(instance);
    const map = this.getController(cls).contextParams;
    for (const field of Object.keys(map)) {
      const { type } = SchemaRegistryIndex.getFieldMap(cls)[field];
      Object.defineProperty(instance, field, { get: ctx.getSource(type) });
    }
  }

  /**
   * Register a controller to bind context params on post construct
   * @param target Controller class
   */
  bindContextParamsOnPostConstruct(cls: Class): void {
    DependencyRegistryIndex.registerClassMetadata(cls, {
      postConstruct: {
        ContextParam: (instance: ClassInstance) => this.#bindContextParams(instance)
      }
    });
  }

  getController(cls: Class): ControllerConfig {
    return this.store.get(cls).get();
  }

  getEndpoint(cls: Class, method: string | symbol): EndpointConfig {
    return this.getController(cls).endpoints.find(e => e.name === method)!;
  }

  getEndpointById(id: string): EndpointConfig | undefined {
    return this.#endpointsById.get(id.replace(':', '#'));
  }

  process(events: ChangeEvent<Class>[]): void {
    for (const evt of events) {
      if ('curr' in evt) {
        for (const ep of this.getController(evt.curr).endpoints) {
          this.#endpointsById.set(`${evt.curr.name}#${ep.name.toString()}`, ep);
        }
      } else {
        // Match by name
        const toDelete = [...this.#endpointsById.values()].filter(x => x.class.name === evt.prev.name);
        for (const ep of toDelete) {
          this.#endpointsById.delete(ep.id);
        }
      }
    }
  }

  finalize(cls: Class): void {
    this.store.finalize(cls);
  }
}