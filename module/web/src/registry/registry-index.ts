import { ChangeEvent, ClassOrId, RegistryIndex, RegistryV2 } from '@travetto/registry';
import { Class, ClassInstance, RetainPrimitiveFields } from '@travetto/runtime';
import { DependencyRegistryIndex } from '@travetto/di';

import { ControllerRegistryAdapter } from './registry-adapter';
import { ControllerConfig, EndpointConfig, EndpointDecorator } from './types';
import { WebAsyncContext } from '../context';
import type { WebInterceptor } from '../types/interceptor.ts';

export class ControllerRegistryIndex implements RegistryIndex<ControllerConfig> {

  static getForRegister(clsOrId: ClassOrId): ControllerRegistryAdapter {
    return RegistryV2.getForRegister(this, clsOrId);
  }

  static getConfig(clsOrId: ClassOrId): ControllerConfig {
    return RegistryV2.get(this, clsOrId).get();
  }

  static getEndpointConfigById(id: string): EndpointConfig | undefined {
    return RegistryV2.instance(ControllerRegistryIndex).getEndpoint(id);
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

  async #bindContextParams<T>(inst: ClassInstance<T>): Promise<void> {
    const ctx = await DependencyRegistryIndex.getInstance(WebAsyncContext);
    const map = this.getController(inst.constructor).contextParams;
    for (const [field, type] of Object.entries(map)) {
      Object.defineProperty(inst, field, { get: ctx.getSource(type) });
    }
  }

  /**
   * Register a controller context param
   * @param target Controller class
   * @param field Field on controller to bind context param to
   * @param type The context type to bind to field
   */
  registerControllerContextParam<T>(target: Class, field: string, type: Class<T>): void {
    const controllerConfig = this.getController(target);
    controllerConfig.contextParams![field] = type;
    RegistryV2.getForRegister(DependencyRegistryIndex, target).registerPostConstructHandler(
      'ContextParam',
      inst => this.#bindContextParams(inst)
    );
  }

  getController(cls: Class): ControllerConfig {
    return RegistryV2.get(ControllerRegistryIndex, cls).get();
  }

  getEndpoint(id: string): EndpointConfig | undefined {
    return this.#endpointsById.get(id.replace(':', '#'));
  }

  adapter(cls: Class): ControllerRegistryAdapter {
    return new ControllerRegistryAdapter(cls);
  }

  process(events: ChangeEvent<Class>[]): void {
    for (const evt of events) {
      if (evt.type !== 'removing') {
        for (const ep of this.getController(evt.curr).endpoints) {
          this.#endpointsById.set(ep.id, ep);
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
}