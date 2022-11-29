import type { Request, Response } from '../types';
import { ContextProvider } from '../decorator/param';

/**
 * @augments `@travetto/rest:Context`
 */
@ContextProvider((__: unknown, rq: Request) => rq)
export class RequestTarget { }

/**
 * @augments `@travetto/rest:Context`
 */
@ContextProvider((__: unknown, rq: Request, rs: Response) => rs)
export class ResponseTarget { }

export class RestInterceptorTarget { }

export const GlobalRoute = Symbol.for('@travetto/rest:global-route');
