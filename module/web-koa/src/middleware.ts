import { Middleware, Context } from 'koa';

import { asConstructable, castTo, Class } from '@travetto/runtime';
import { ControllerRegistry, EndpointDecorator, EndpointFunction, EndpointFunctionDescriptor, HttpFilter, WebInternal } from '@travetto/web';

/**
 * Support the ability to inline arbitrary middleware
 */
export function KoaMiddleware(...middleware: [Middleware, ...Middleware[]]): EndpointDecorator {
  return function <T>(target: T | Class<T>, property?: string, descriptor?: EndpointFunctionDescriptor) {
    const cls = descriptor ? asConstructable(target).constructor : castTo<Class>(target);

    for (const item of middleware) {
      const handler: HttpFilter = async ctx => {
        await new Promise<void>((res, rej) =>
          item(castTo<Context>(ctx.req[WebInternal].providerEntity), async () => res())
        );
        return ctx.next();
      };
      if (descriptor) {
        ControllerRegistry.registerEndpointFilter(cls, descriptor.value!, handler);
      } else {
        ControllerRegistry.registerControllerFilter(cls, handler);
      }
    }
  };
}