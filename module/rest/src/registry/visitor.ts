import { Class } from '@travetto/runtime';
import { SchemaRegistry } from '@travetto/schema';

import { ControllerVisitor } from './types';
import { ControllerRegistry } from './controller';

export type ControllerVisitorOptions = { skipUndocumented?: boolean };

/**
 * Supports visiting the controller structure
 */
export class ControllerVisitUtil {

  static #onSchemaEvent(visitor: ControllerVisitor, type?: Class): unknown | Promise<unknown> {
    return type && SchemaRegistry.has(type) ? visitor.onSchema?.(SchemaRegistry.get(type)) : undefined;
  }

  static async visitController(visitor: ControllerVisitor, cls: Class, options: ControllerVisitorOptions = {}): Promise<void> {
    options.skipUndocumented ??= true;

    const controller = ControllerRegistry.get(cls);
    if (!controller || controller.documented === false && options.skipUndocumented) {
      return;
    }

    await visitor.onControllerStart?.(controller);
    for (const endpoint of controller.endpoints) {
      if (endpoint.documented === false && options.skipUndocumented) {
        continue;
      }

      const params = SchemaRegistry.getMethodSchema(cls, endpoint.handlerName);
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
    for (const cls of ControllerRegistry.getClasses()) {
      await this.visitController(visitor, cls, options);
    }
    return await visitor.onComplete?.() ?? undefined!;
  }
}
