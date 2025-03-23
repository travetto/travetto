import type { Handler, Response, Request } from 'express';

import { asConstructable, castTo, Class } from '@travetto/runtime';
import { ControllerRegistry, EndpointDecorator, EndpointFunctionDescriptor, HttpChainedFilter, WebInternal } from '@travetto/web';

/**
 * Support the ability to inline arbitrary middleware
 */
export function ExpressMiddleware(...middleware: [Handler, ...Handler[]]): EndpointDecorator {
  return function <T>(target: T | Class<T>, property?: string, descriptor?: EndpointFunctionDescriptor) {

    const cls = descriptor ? asConstructable(target).constructor : castTo<Class>(target);
    for (const item of middleware) {
      const handler: HttpChainedFilter = async (ctx) => {
        await new Promise<void>((res, rej) => item(
          castTo<Request>(ctx.req[WebInternal].providerEntity),
          castTo<Response>(ctx.res[WebInternal].providerEntity),
          (err?: unknown) => err ? rej(err) : res()));
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
