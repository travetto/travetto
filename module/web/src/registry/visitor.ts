import type { Class } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ControllerRegistryIndex } from './registry-index.ts';
import type { ControllerVisitor, ControllerVisitorOptions } from './types.ts';

/**
 * Supports visiting the controller structure
 */
export class ControllerVisitUtil {
  static #onSchemaEvent(visitor: ControllerVisitor, type: Class): unknown | Promise<unknown> {
    return visitor.onSchema?.(SchemaRegistryIndex.getConfig(type));
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

      await visitor.onEndpointStart?.(endpoint, controller);
      if (SchemaRegistryIndex.has(endpointSchema.returnType?.type)) {
        await this.#onSchemaEvent(visitor, endpointSchema.returnType.type);
      }
      for (const param of endpointSchema.parameters) {
        if (SchemaRegistryIndex.has(param.type)) {
          await this.#onSchemaEvent(visitor, param.type);
        }
      }
      await visitor.onEndpointEnd?.(endpoint, controller);
    }
    await visitor.onControllerEnd?.(controller);
  }

  static async visit<T = unknown>(visitor: ControllerVisitor<T>, options: ControllerVisitorOptions = {}): Promise<T> {
    for (const cls of ControllerRegistryIndex.getClasses()) {
      await this.visitController(visitor, cls, options);
    }
    return (await visitor.onComplete?.()) ?? undefined!;
  }
}
