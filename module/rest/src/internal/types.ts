import type { Request, Response } from '../types';
import { ContextProvider } from '../decorator/param';

@ContextProvider((__: unknown, rq: Request) => rq)
export class RequestTarget { }

@ContextProvider((__: unknown, rq: Request, rs: Response) => rs)
export class ResponseTarget { }

export class RestInterceptorTarget { }

export const GlobalRoute = Symbol.for('@trv:rest/global-route');
