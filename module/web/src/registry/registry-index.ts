import { ChangeEvent, ClassOrId, RegistryIndex, RegistryV2 } from '@travetto/registry';
import { Class, ClassInstance } from '@travetto/runtime';
import { DependencyRegistry } from '@travetto/di';

import { ControllerRegistryAdapter } from './registry-adapter';
import { ControllerConfig, EndpointConfig } from './types';
import { WebAsyncContext } from '../context';


export class ControllerRegistryIndex implements RegistryIndex<ControllerConfig, EndpointConfig> {

  static getForRegister(clsOrId: ClassOrId): ControllerRegistryAdapter {
    return RegistryV2.getForRegister(this, clsOrId);
  }

  static get(clsOrId: ClassOrId): Omit<ControllerRegistryAdapter, `register${string}` | 'finalize' | 'unregister'> {
    return RegistryV2.get(this, clsOrId);
  }

  static getClassConfig(clsOrId: ClassOrId): ControllerConfig {
    return RegistryV2.get(this, clsOrId).getClass();
  }

  static getClasses(): Class[] {
    return RegistryV2.getAll(this);
  }

  static has(clsOrId: ClassOrId): boolean {
    return RegistryV2.has(this, clsOrId);
  }

  static getEndpointById(id: string): EndpointConfig | undefined {
    return RegistryV2.instance(ControllerRegistryIndex).getEndpointById(id);
  }

  #endpointsById = new Map<string, EndpointConfig>();

  async #bindContextParams<T>(inst: ClassInstance<T>): Promise<void> {
    const ctx = await DependencyRegistry.getInstance(WebAsyncContext);
    const map = this.getClassConfig(inst.constructor).contextParams;
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
    const controllerConfig = this.getClassConfig(target);
    controllerConfig.contextParams![field] = type;
    DependencyRegistry.registerPostConstructHandler(target, 'ContextParam', inst => this.#bindContextParams(inst));
  }

  getClassConfig(cls: Class): ControllerConfig {
    return RegistryV2.get(ControllerRegistryIndex, cls).getClass();
  }

  getEndpointById(id: string): EndpointConfig | undefined {
    return this.#endpointsById.get(id.replace(':', '#'));
  }

  adapter(cls: Class): ControllerRegistryAdapter {
    return new ControllerRegistryAdapter(cls);
  }
  process(events: ChangeEvent<Class>[]): void {
    for (const evt of events) {
      if (evt.type !== 'removing') {
        for (const ep of this.getClassConfig(evt.curr).endpoints) {
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