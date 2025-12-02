import { Class } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ControllerVisitor, ControllerVisitorOptions } from './types.ts';
import { ControllerRegistryIndex } from './registry-index.ts';

/**
 * Supports visiting the controller structure
 */
export class ControllerVisitUtil {

  static #onSchemaEvent(visitor: ControllerVisitor, type?: Class): unknown | Promise<unknown> {
    return type && SchemaRegistryIndex.has(type) ? visitor.onSchema?.(SchemaRegistryIndex.getConfig(type)) : undefined;
  }

  static async visitController(visitor: ControllerVisitor, cls: Class, options: ControllerVisitorOptions = {}): Promise<void> {
    if (visitor.getOptions) {
      options = Object.assign(visitor.getOptions(), options);
    }

    options.skipPrivate ??= true;

    const controller = ControllerRegistryIndex.getConfig(cls);
    const schema = SchemaRegistryIndex.getConfig(cls);
    if (schema.private === true && options.skipPrivate) {
      return;
    }

    await visitor.onControllerStart?.(controller);
    for (const endpoint of controller.endpoints) {
      const endpointSchema = SchemaRegistryIndex.get(cls).getMethod(endpoint.methodName);
      if (endpointSchema.private === true && options.skipPrivate) {
        continue;
      }

      const { parameters: params, returnType } = endpointSchema;
      await visitor.onEndpointStart?.(endpoint, controller, params);
      if (returnType) {
        await this.#onSchemaEvent(visitor, returnType.type);
      }
      for (const param of params) {
        await this.#onSchemaEvent(visitor, param.type);
      }
      await visitor.onEndpointEnd?.(endpoint, controller, params);
    }
    await visitor.onControllerEnd?.(controller);
  }

  static async visit<T = unknown>(visitor: ControllerVisitor<T>, options: ControllerVisitorOptions = {}): Promise<T> {
    for (const cls of ControllerRegistryIndex.getClasses()) {
      await this.visitController(visitor, cls, options);
    }
    return await visitor.onComplete?.() ?? undefined!;
  }
}
