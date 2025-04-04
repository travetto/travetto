import { HttpResponse } from './types/response.ts';
import { HttpRequest } from './types/request.ts';

export type HttpContext<C = {}> = { req: HttpRequest } & C;
export type HttpFilter<C extends HttpContext = HttpContext> = (context: C) => Promise<HttpResponse>;
export type HttpChainedContext<C = unknown> = HttpContext<{ next: () => Promise<HttpResponse>, config: C }>;
export type HttpChainedFilter<C = unknown> = HttpFilter<HttpChainedContext<C>>;