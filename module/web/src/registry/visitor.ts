import { Class } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';
import { RegistryV2 } from '@travetto/registry';

import { ControllerVisitor, ControllerVisitorOptions } from './types.ts';
import { ControllerRegistryIndex } from './registry-index.ts';

/**
 * Supports visiting the controller structure
 */
export class ControllerVisitUtil {

  static #onSchemaEvent(visitor: ControllerVisitor, type?: Class): unknown | Promise<unknown> {
    return type && SchemaRegistryIndex.has(type) ? visitor.onSchema?.(SchemaRegistryIndex.getClassConfig(type)) : undefined;
  }

  static async visitController(visitor: ControllerVisitor, cls: Class, options: ControllerVisitorOptions = {}): Promise<void> {
    if (visitor.getOptions) {
      options = Object.assign(visitor.getOptions(), options);
    }

    options.skipUndocumented ??= true;

    const controller = ControllerRegistryIndex.getConfig(cls);
    if (controller.documented === false && options.skipUndocumented) {
      return;
    }

    await visitor.onControllerStart?.(controller);
    for (const endpoint of controller.endpoints) {
      if (endpoint.documented === false && options.skipUndocumented) {
        continue;
      }

      const { parameters: params } = SchemaRegistryIndex.getMethodConfig(cls, endpoint.name);
      await visitor.onEndpointStart?.(endpoint, controller, params);
      await this.#onSchemaEvent(visitor, endpoint.responseType?.type);
      await this.#onSchemaEvent(visitor, endpoint.requestType?.type);
      for (const param of params) {
        await this.#onSchemaEvent(visitor, param.type);
      }
      await visitor.onEndpointEnd?.(endpoint, controller, params);
    }
    await visitor.onControllerEnd?.(controller);
  }

  static async visit<T = unknown>(visitor: ControllerVisitor<T>, options: ControllerVisitorOptions = {}): Promise<T> {
    for (const cls of RegistryV2.getClasses(ControllerRegistryIndex)) {
      await this.visitController(visitor, cls, options);
    }
    return await visitor.onComplete?.() ?? undefined!;
  }
}
