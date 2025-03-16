import { Middleware, Context } from 'koa';

import { asConstructable, castTo, Class } from '@travetto/runtime';
import { ControllerRegistry, EndpointDecorator, EndpointHandler, Filter, WebInternal } from '@travetto/web';

/**
 * Support the ability to inline arbitrary middleware
 */
export function KoaMiddleware(...middleware: [Middleware, ...Middleware[]]): EndpointDecorator {
  return function <T>(target: T | Class<T>, property?: string, descriptor?: TypedPropertyDescriptor<EndpointHandler>) {
    const cls = descriptor ? asConstructable(target).constructor : castTo<Class>(target);

    for (const item of middleware) {
      const handler: Filter = (ctx, next) => item(castTo<Context>(ctx.req[WebInternal].providerEntity), async () => next());
      if (descriptor) {
        ControllerRegistry.registerEndpointFilter(cls, descriptor.value!, handler);
      } else {
        ControllerRegistry.registerControllerFilter(cls, handler);
      }
    }
  };
}