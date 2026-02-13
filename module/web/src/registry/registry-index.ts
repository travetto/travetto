import { type RegistryIndex, RegistryIndexStore, Registry } from '@travetto/registry';
import { type Class, type ClassInstance, getClass, isClass, type RetainIntrinsicFields } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ControllerRegistryAdapter } from './registry-adapter.ts';
import type { ControllerConfig, EndpointConfig, EndpointDecorator } from './types.ts';
import { WebAsyncContext } from '../context.ts';
import type { WebInterceptor } from '../types/interceptor.ts';

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
   * @param config The partial config override
   */
  static createInterceptorConfigDecorator<T extends WebInterceptor>(
    cls: Class<T>,
    config: Partial<RetainIntrinsicFields<T['config']>>,
    extra?: Partial<EndpointConfig & ControllerConfig>
  ): EndpointDecorator {
    return (instanceOrCls: Class | ClassInstance, property?: string): void => {
      const adapter = ControllerRegistryIndex.getForRegister(getClass(instanceOrCls));
      if (isClass(instanceOrCls)) {
        adapter.registerInterceptorConfig(cls, config, extra);
      } else {
        adapter.registerEndpointInterceptorConfig(property!, cls, config, extra);
      }
    };
  }

  #endpointsById = new Map<string, EndpointConfig>();

  store = new RegistryIndexStore(ControllerRegistryAdapter);

  /** @private */ constructor(source: unknown) { Registry.validateConstructor(source); }

  async #bindContextParams<T>(instance: ClassInstance<T>): Promise<void> {
    const ctx = await DependencyRegistryIndex.getInstance(WebAsyncContext);
    const cls = getClass(instance);
    const map = this.getController(cls).contextParams;
    const fieldMap = SchemaRegistryIndex.get(cls).getFields();
    for (const field of Object.keys(map)) {
      const { type } = fieldMap[field];
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

  getEndpointById(id: string): EndpointConfig | undefined {
    return this.#endpointsById.get(id.replace(':', '#'));
  }

  onCreate(cls: Class): void {
    for (const endpoint of this.getController(cls).endpoints) {
      this.#endpointsById.set(endpoint.id, endpoint);
    }
  }
}