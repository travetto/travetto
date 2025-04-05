import { WebResponse } from './types/response.ts';
import { WebRequest } from './types/request.ts';

export type WebContext<C = {}> = { req: WebRequest } & C;
export type WebFilter<C extends WebContext = WebContext> = (context: C) => Promise<WebResponse>;
export type WebChainedContext<C = unknown> = WebContext<{ next: () => Promise<WebResponse>, config: C }>;
export type WebChainedFilter<C = unknown> = WebFilter<WebChainedContext<C>>;