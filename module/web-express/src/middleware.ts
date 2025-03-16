import type { Handler, Response, Request } from 'express';

import { asConstructable, castTo, Class } from '@travetto/runtime';
import { ControllerRegistry, EndpointDecorator, EndpointHandler, Filter, WebSymbols } from '@travetto/web';

/**
 * Support the ability to inline arbitrary middleware
 */
export function ExpressMiddleware(...middleware: [Handler, ...Handler[]]): EndpointDecorator {
  return function <T>(target: T | Class<T>, property?: string, descriptor?: TypedPropertyDescriptor<EndpointHandler>) {

    const cls = descriptor ? asConstructable(target).constructor : castTo<Class>(target);
    for (const item of middleware) {
      const handler: Filter = (ctx, next) => {
        item(
          castTo<Request>(ctx.req[WebSymbols.Internal].providerEntity),
          castTo<Response>(ctx.res[WebSymbols.Internal].providerEntity),
          (err?: unknown) => {
            if (err) {
              throw err;
            } else {
              next();
            }
          }
        );
      };
      if (descriptor) {
        ControllerRegistry.registerEndpointFilter(cls, descriptor.value!, handler);
      } else {
        ControllerRegistry.registerControllerFilter(cls, handler);
      }
    }
  };
}
