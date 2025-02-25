import type { Request, Response } from '../types.ts';
import { ContextProvider } from '../decorator/param.ts';

/**
 * @augments `@travetto/rest:ContextParam`
 */
@ContextProvider((__: unknown, rq: Request) => rq)
export class RequestTarget { }

/**
 * @augments `@travetto/rest:ContextParam`
 */
@ContextProvider((__: unknown, rq: Request, rs: Response) => rs)
export class ResponseTarget { }

export class RestInterceptorTarget { }

export const GlobalRoute = Symbol.for('@travetto/rest:global-route');
