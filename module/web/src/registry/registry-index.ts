import { ChangeEvent, ClassOrId, RegistryIndexStore, RegistryV2 } from '@travetto/registry';
import { Class, ClassInstance, RetainPrimitiveFields } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ControllerRegistryAdapter } from './registry-adapter';
import { ControllerConfig, EndpointConfig, EndpointDecorator } from './types';
import { WebAsyncContext } from '../context';
import type { WebInterceptor } from '../types/interceptor.ts';

export class ControllerRegistryIndex {

  static #instance = RegistryV2.registerIndex(this);

  static getClasses(): Class[] {
    return this.#instance.store.getClasses();
  }

  static getForRegister(clsOrId: ClassOrId): ControllerRegistryAdapter {
    return this.#instance.store.getForRegister(clsOrId);
  }

  static getConfig(clsOrId: ClassOrId): ControllerConfig {
    return this.#instance.store.get(clsOrId).get();
  }

  static getEndpointConfigById(id: string): EndpointConfig | undefined {
    return this.#instance.getEndpointById(id);
  }

  static registerControllerContextParam(target: ClassOrId, field: string | symbol): void {
    this.#instance.registerControllerContextParam(target, field);
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
    return (target: unknown, prop?: symbol | string): void => {
      if (prop) {
        ControllerRegistryIndex.getForRegister(target).registerEndpointInterceptorConfig(prop, cls, cfg, extra);
      } else {
        ControllerRegistryIndex.getForRegister(target).registerInterceptorConfig(cls, cfg, extra);
      }
    };
  }

  #endpointsById = new Map<string, EndpointConfig>();

  store = new RegistryIndexStore(ControllerRegistryAdapter);

  async #bindContextParams<T>(inst: ClassInstance<T>): Promise<void> {
    const ctx = await DependencyRegistryIndex.getInstance(WebAsyncContext);
    const map = this.getController(inst.constructor).contextParams;
    for (const field of Object.keys(map)) {
      const { type } = SchemaRegistryIndex.getFieldMap(inst)[field];
      Object.defineProperty(inst, field, { get: ctx.getSource(type) });
    }
  }

  /**
   * Register a controller context param
   * @param target Controller class
   * @param field Field on controller to bind context param to
   */
  registerControllerContextParam(target: ClassOrId, field: string | symbol): void {
    const controllerConfig = this.getController(target);
    controllerConfig.contextParams[field] = true;
    DependencyRegistryIndex.registerClassMetadata(target, {
      postConstruct: {
        ContextParam: (inst: ClassInstance) => this.#bindContextParams(inst)
      }
    });
  }

  getController(cls: ClassOrId): ControllerConfig {
    return this.store.get(cls).get();
  }

  getEndpoint(cls: ClassOrId, method: string | symbol): EndpointConfig {
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