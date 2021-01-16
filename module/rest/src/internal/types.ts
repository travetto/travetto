import type { Request, Response } from '../types';
import { ContextProvider } from '../decorator/param';

@ContextProvider((__: unknown, rq: Request) => rq)
export class RequestCls { }

@ContextProvider((__: unknown, rq: Request, rs: Response) => rs)
export class ResponseCls { }

export class RestInterceptorTarget { }

export const GlobalRoute = Symbol.for('@trv:rest/global-route');
