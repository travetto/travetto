import type { Request, Response } from '../types';
import { ContextProvider } from '../decorator/param';

@ContextProvider((__: any, rq: Request) => rq)
export class RequestCls { }

@ContextProvider((__: any, rq: Request, rs: Response) => rs)
export class ResponseCls { }

export class RestInterceptorTarget { }

export const GlobalRoute = Symbol.for('@trv:rest/global-route');
