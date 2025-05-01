import { WebResponse } from './response.ts';
import { WebRequest } from './request.ts';

export type WebFilterContext<C = {}> = { request: WebRequest } & C;
export type WebFilter<C extends WebFilterContext = WebFilterContext> = (context: C) => Promise<WebResponse>;
export type WebChainedContext<C = unknown> = WebFilterContext<{ next: () => Promise<WebResponse>, config: C }>;
export type WebChainedFilter<C = unknown> = WebFilter<WebChainedContext<C>>;
